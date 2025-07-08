import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, inject, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// TensorFlow.js and Pose Detection
import * as posedetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl'; // Preferred backend for performance
// import '@tensorflow/tfjs-backend-cpu'; // Fallback or for environments without WebGL

interface WorkoutFeedback {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

enum RepState {
  START = 'START', // General starting state, or specific "down" state for an exercise
  UP = 'UP',       // General "up" or completed state for an exercise
  // For more complex exercises, you might add:
  // RACKED = 'RACKED',
  // OVERHEAD = 'OVERHEAD',
  // PULLING = 'PULLING',
  // CATCHING = 'CATCHING',
}

@Component({
  selector: 'app-workout-tracker', // Ensure this selector is correct for your application
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kb-workout-tracker.html',
  styleUrls: ['./kb-workout-tracker.scss'] // Assuming you are using SCSS
})
export class KettleBellWorkoutTrackerComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElementRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElementRef!: ElementRef<HTMLCanvasElement>;

  protected videoStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private poseDetector: posedetection.PoseDetector | null = null;

  modelReady = false; // Public for template binding
  public isFeedbackVisible: boolean = false; // Modal starts hidden
  public isControlsExpanded: boolean = false; // New property for FAB state, initially closed

  isCameraReady = false;
  isRecording = false;
  isWorkoutActive = false;
  repCount = 0;
  elapsedTime = 0;
  timerInterval: any;

  feedbackMessages: WorkoutFeedback[] = [];
  public currentExercise = 'Right Bicep Curl'; // Default exercise

  private changeDetectorRef = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private animationFrameId: number | null = null;

  // Exercise-specific state and logic
  private currentRepCycleState: RepState = RepState.START;
  private exerciseSpecificLogic: ((pose: posedetection.Pose) => void) | null = null;

  // --- THRESHOLDS (CRITICAL FOR TUNING) ---
  // General
  private KEYPOINT_SCORE_THRESHOLD = 0.5;  // was 0.4 → improve accuracy
  private STABLE_FRAME_COUNT = 3;          // was 2 → reduce false positives
  private lastFramesStates: { [key: string]: boolean[] } = {}; // Debounce history

  // Bicep Curl
  private BICEP_ELBOW_ANGLE_UP = 50;       // was 70 → tighter top position
  private BICEP_ELBOW_ANGLE_DOWN = 160;    // was 150 → clearer full extension
  private BICEP_WRIST_ELBOW_VERTICAL_DIFF_DOWN = 10; // was -10 → correct direction (wrist should be below elbow)

  // Kettlebell Snatch (very rough placeholders)
  private SNATCH_HIP_EXTENSION_ANGLE_START = 170;   // was 160
  private SNATCH_ARM_LOCKOUT_SHOULDER_WRIST_ALIGNMENT_Y = 30; // was 20 → tolerate more variation
  private SNATCH_KNEE_ANGLE_BOTTOM = 80;            // was 90 → deeper bottom

  // Kettlebell Press
  private PRESS_ELBOW_ANGLE_UP = 170;               // was 160 → clearer lockout
  private PRESS_ELBOW_ANGLE_RACK = 90;
  private PRESS_WRIST_SHOULDER_Y_DIFF_UP = -10;     // was -20 → allow for more wrist height variation
  private PRESS_WRIST_SHOULDER_Y_DIFF_RACK = 20;    // was 10 → allow more tolerance
  private PRESS_WRIST_SHOULDER_X_ALIGNMENT = 30;    // was 40
  private PRESS_TORSO_LEAN_X_ALIGNMENT = 40;        // was 50 → stricter uprightness


  private JERK_ELBOW_LOCKOUT_ANGLE = 165;     // at the end of the jerk (overhead)
  private JERK_ELBOW_RACK_ANGLE = 90;         // in rack position
  private JERK_KNEE_DIP_ANGLE = 90;           // deep knee bend during dip/drive
  private JERK_SECOND_DIP_KNEE_ANGLE = 100;   // shallower than initial dip

  private JERK_WRIST_SHOULDER_Y_DIFF_LOCKOUT = -20;
  private JERK_WRIST_SHOULDER_X_ALIGNMENT = 30;

  alternatingArm: string = '';

  // --- NEW PROPERTIES FOR DRAGGABLE FAB ---
  public fabPosition = { x: 0, y: 0 }; // Initial position (will be set dynamically)
  private isFabDragging = false;
  private fabDragStartOffset = { x: 0, y: 0 }; // Offset from mouse click to FAB top-left
  private fabElementRef!: ElementRef<HTMLElement>; // To get FAB dimensions if needed

  // --- LIFECYCLE HOOKS ---
  async ngOnInit() {
    this.addFeedback('info', 'Initializing TensorFlow.js backend...');
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      this.addFeedback('info', `TensorFlow.js backend set to: ${tf.getBackend()}`);
    } catch (e) {
      console.error("Error setting TF backend:", e);
      this.addFeedback('error', `Error setting TF backend: ${e instanceof Error ? e.message : String(e)}`);
      try {
        await tf.setBackend('cpu');
        await tf.ready();
        this.addFeedback('warning', `Fell back to TF.js backend: ${tf.getBackend()}`);
      } catch (cpuError) {
        this.addFeedback('error', `CPU backend also failed: ${cpuError instanceof Error ? cpuError.message : String(cpuError)}`);
        return; // Critical failure, can't proceed
      }
    }

    await this.setupCamera();
    await this.loadPoseDetectionModel();
    this.setExerciseLogic(this.currentExercise); // Set initial exercise logic
    this.initializeFabPosition();
  }

  constructor(private hostElement: ElementRef<HTMLElement>) { }

  ngOnDestroy() {
    this.stopWorkout(); // This also stops the animation frame
    this.stopCamera();
    if (this.poseDetector) {
      this.poseDetector.dispose();
      this.addFeedback('info', 'Pose detection model disposed.');
      this.poseDetector = null;
    }
  }

  // --- CAMERA AND MODEL SETUP ---
  async setupCamera() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (this.videoElementRef && this.canvasElementRef) {
          const videoNode = this.videoElementRef.nativeElement;
          const canvasNode = this.canvasElementRef.nativeElement;

          videoNode.srcObject = this.videoStream;
          videoNode.onloadedmetadata = () => {
            videoNode.play().then(() => {
              this.isCameraReady = true;
              this.addFeedback('info', 'Camera ready.');
              // Set canvas dimensions once video metadata is loaded and video is playing
              canvasNode.width = videoNode.videoWidth;
              canvasNode.height = videoNode.videoHeight;
              this.changeDetectorRef.detectChanges();
            }).catch(playError => {
              console.error("Error playing video:", playError);
              this.addFeedback('error', "Could not start video playback");
            });
          };
        }
      } else {
        this.addFeedback('error', 'getUserMedia not supported in this browser.');
        this.isCameraReady = false;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.addFeedback('error', `Error accessing camera: ${error instanceof Error ? error.message : String(error)}`);
      if ((error as any).name === 'NotAllowedError') { // Check for permission denial
        this.addFeedback('warning', 'Camera permission denied. Please allow camera access.');
      }
      this.isCameraReady = false;
    }
    this.changeDetectorRef.detectChanges(); // Ensure UI reflects camera status
  }

  async loadPoseDetectionModel() {
    if (this.poseDetector) {
      this.poseDetector.dispose(); // Dispose existing model if any
      this.poseDetector = null;
    }
    this.modelReady = false;
    this.addFeedback('info', 'Loading pose detection model (MoveNet Lightning)...');
    this.changeDetectorRef.detectChanges(); // Update UI to show loading

    try {
      const model = posedetection.SupportedModels.MoveNet;
      const detectorConfig: posedetection.MoveNetModelConfig = {
        modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        // enableSmoothing: true, // Optional: smoother but might add slight latency
      };
      this.poseDetector = await posedetection.createDetector(model, detectorConfig);
      this.modelReady = true;
      this.addFeedback('success', 'Pose detection model loaded successfully!');
    } catch (error) {
      console.error('Error loading pose detection model:', error);
      this.addFeedback('error', `Could not load AI model: ${error instanceof Error ? error.message : String(error)}`);
      this.modelReady = false;
    } finally {
      this.changeDetectorRef.detectChanges(); // Update UI with model status
    }
  }

  // --- WORKOUT CONTROL ---
  startWorkout() {
    if (!this.isCameraReady) {
      this.addFeedback('warning', 'Camera not ready.');
      return;
    }
    if (!this.modelReady || !this.poseDetector) {
      this.addFeedback('warning', 'AI Model not ready. Please wait or try reloading model.');
      return;
    }

    this.isWorkoutActive = true;
    this.repCount = 0;
    this.elapsedTime = 0;
    this.lastFramesStates = {}; // Reset debounce history for the new workout session
    this.currentRepCycleState = RepState.START; // Reset exercise state
    this.feedbackMessages = [{ type: 'success', message: 'Workout started! Form tracking active.' }]; // Clear previous logs
    this.changeDetectorRef.detectChanges();

    this.timerInterval = setInterval(() => {
      this.elapsedTime++;
      this.changeDetectorRef.detectChanges();
    }, 1000);

    if (this.animationFrameId) { // Clear any existing animation frame
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
  }

  stopWorkout() {
    this.isWorkoutActive = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.addFeedback('info', `Workout stopped. Total reps: ${this.repCount}. Time: ${this.formatTime(this.elapsedTime)}`);

    // Clear canvas when workout stops
    const canvas = this.canvasElementRef?.nativeElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    this.changeDetectorRef.detectChanges();
  }

  stopCamera() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    // Clear the video element source
    if (this.videoElementRef?.nativeElement.srcObject) {
      this.videoElementRef.nativeElement.srcObject = null;
    }
    this.isCameraReady = false;
    this.changeDetectorRef.detectChanges();
  }

  // --- POSE PROCESSING AND DRAWING ---
  private processVideoFrame = async () => {
    if (!this.isWorkoutActive || !this.videoElementRef || !this.canvasElementRef || !this.poseDetector || !this.modelReady) {
      if (this.isWorkoutActive) { // If still supposed to be active, retry next frame
        this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
      }
      return;
    }

    const video = this.videoElementRef.nativeElement;
    const canvas = this.canvasElementRef.nativeElement;

    if (video.readyState < video.HAVE_CURRENT_DATA) { // Ensure video has data
      this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
      return;
    }

    try {
      // Ensure canvas dimensions match video frame dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (video.videoWidth === 0 || video.videoHeight === 0) { // Safety check if dimensions are 0
          this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
          return;
        }
      }

      const poses = await this.poseDetector.estimatePoses(video, {
        flipHorizontal: false // Adjust if your camera feed is mirrored
      });

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous pose

        if (poses && poses.length > 0) {
          const pose = poses[0]; // Assuming single person detection
          this.drawPose(pose.keypoints, ctx);
          this.analyzePoseForReps(pose); // Perform exercise analysis
        }
      }
    } catch (error) {
      console.error("Error during pose estimation or drawing:", error);
      this.addFeedback('error', 'AI processing error. Workout may be affected.');
    }

    if (this.isWorkoutActive) { // Continue loop if workout is still active
      this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
    }
  }

  private drawPose(keypoints: posedetection.Keypoint[], ctx: CanvasRenderingContext2D) {
    const minConfidence = 0.3; // Threshold for drawing keypoints/lines

    // Draw keypoints
    ctx.fillStyle = 'aqua';
    for (const keypoint of keypoints) {
      if (keypoint.score != null && keypoint.score >= minConfidence) {
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw skeleton lines
    const adjacentPairs = posedetection.util.getAdjacentPairs(posedetection.SupportedModels.MoveNet);
    ctx.strokeStyle = 'lime';
    ctx.lineWidth = 3;
    for (const [kp1Index, kp2Index] of adjacentPairs) {
      const kp1 = keypoints[kp1Index];
      const kp2 = keypoints[kp2Index];
      if (kp1 && kp2 && (kp1.score ?? 0) >= minConfidence && (kp2.score ?? 0) >= minConfidence) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    }
  }

  // --- EXERCISE LOGIC MANAGEMENT ---
  setExerciseLogic(exerciseName: string) {
    this.currentRepCycleState = RepState.START;
    this.repCount = 0; // Reset reps when changing exercise
    this.lastFramesStates = {}; // Reset debounce history
    this.addFeedback('info', `Switched to exercise: ${exerciseName}`);
    this.currentExercise = exerciseName; // Update current exercise name for UI

    if (exerciseName === 'Right Bicep Curl') {
      this.exerciseSpecificLogic = this.analyzeRightBicepCurl;
    } else if (exerciseName === 'Left Bicep Curl') {
      this.exerciseSpecificLogic = this.analyzeLeftBicepCurl;
    } else if (exerciseName === 'Alternating Bicep Curl') {
      this.exerciseSpecificLogic = this.analyzeAlternatingBicepCurl;
    } else if (exerciseName === 'Kettlebell Snatch') {
      this.exerciseSpecificLogic = this.analyzeKettlebellSnatch;
    } else if (exerciseName === 'Kettlebell Press') {
      this.exerciseSpecificLogic = this.analyzeKettlebellPress;
    } else if (exerciseName === 'Goblet Squat') {
      this.exerciseSpecificLogic = this.analyzeGobletSquat;
    } else if (exerciseName === 'Deadlift') {
      this.exerciseSpecificLogic = this.analyzeDeadlift;
    } else if (exerciseName === 'Kettlebell Jerk') {
      this.exerciseSpecificLogic = this.analyzeKettlebellJerk;
    }

    // Add more 'else if' blocks for other exercises
    else {
      this.addFeedback('warning', `No specific logic implemented for exercise: ${exerciseName}`);
      this.exerciseSpecificLogic = null; // No analyzer for unknown exercises
    }
    this.changeDetectorRef.detectChanges(); // Update UI
  }

  private analyzePoseForReps(pose: posedetection.Pose) {
    if (this.exerciseSpecificLogic) {
      this.exerciseSpecificLogic.call(this, pose); // Use .call to maintain 'this' context if needed, though direct call usually works too
    }
  }

  // --- SPECIFIC EXERCISE ANALYSIS METHODS ---
  private analyzeRightBicepCurl(pose: posedetection.Pose) {
    const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const rightElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
    const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');

    if (!rightShoulder || !rightElbow || !rightWrist) {
      return;
    }

    if ((rightShoulder.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (rightElbow.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (rightWrist.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD) {
      return;
    }

    const elbowAngle = this.calculateAngle(rightShoulder, rightElbow, rightWrist);

    if (elbowAngle === null) {
      return;
    }

    if (this.currentRepCycleState === RepState.START) {
      if (elbowAngle < this.BICEP_ELBOW_ANGLE_UP) {
        this.currentRepCycleState = RepState.UP;
        this.addFeedback('info', `Curl: Up phase detected (Angle: ${elbowAngle.toFixed(0)}°)`);
      }
    } else if (this.currentRepCycleState === RepState.UP) {
      if (elbowAngle > this.BICEP_ELBOW_ANGLE_DOWN) {
        this.incrementRep();
        this.currentRepCycleState = RepState.START;
        this.addFeedback('success', `Curl: Down phase, Rep Complete! (Angle: ${elbowAngle.toFixed(0)}°)`);
      }
    }
  }

  private analyzeLeftBicepCurl(pose: posedetection.Pose) {
    const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
    const leftElbow = pose.keypoints.find(kp => kp.name === 'left_elbow');
    const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');

    if (!leftShoulder || !leftElbow || !leftWrist) {
      return;
    }

    if ((leftShoulder.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (leftElbow.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (leftWrist.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD) {
      return;
    }

    const elbowAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);

    if (elbowAngle === null) {
      return;
    }

    if (this.currentRepCycleState === RepState.START) {
      if (elbowAngle < this.BICEP_ELBOW_ANGLE_UP) {
        this.currentRepCycleState = RepState.UP;
        this.addFeedback('info', `Left Curl: Up phase detected (Angle: ${elbowAngle.toFixed(0)}°)`);
      }
    } else if (this.currentRepCycleState === RepState.UP) {
      if (elbowAngle > this.BICEP_ELBOW_ANGLE_DOWN) {
        this.incrementRep();
        this.currentRepCycleState = RepState.START;
        this.addFeedback('success', `Left Curl: Down phase, Rep Complete! (Angle: ${elbowAngle.toFixed(0)}°)`);
      }
    }
  }

  private analyzeAlternatingBicepCurl(pose: posedetection.Pose) {
    const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const rightElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
    const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
    const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
    const leftElbow = pose.keypoints.find(kp => kp.name === 'left_elbow');
    const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');

    if (
      !rightShoulder || !rightElbow || !rightWrist ||
      !leftShoulder || !leftElbow || !leftWrist
    ) {
      return;
    }

    if (
      (rightShoulder.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (rightElbow.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (rightWrist.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (leftShoulder.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (leftElbow.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (leftWrist.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD
    ) {
      return;
    }

    const rightElbowAngle = this.calculateAngle(rightShoulder, rightElbow, rightWrist);
    const leftElbowAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);

    if (rightElbowAngle === null || leftElbowAngle === null) {
      return;
    }

    // Track which arm is currently curling
    if (!this['alternatingArm']) {
      this['alternatingArm'] = 'right';
    }

    if (this['alternatingArm'] === 'right') {
      if (this.currentRepCycleState === RepState.START) {
        if (rightElbowAngle < this.BICEP_ELBOW_ANGLE_UP) {
          this.currentRepCycleState = RepState.UP;
          this.addFeedback('info', `Alt Curl: Right up phase (Angle: ${rightElbowAngle.toFixed(0)}°)`);
        }
      } else if (this.currentRepCycleState === RepState.UP) {
        if (rightElbowAngle > this.BICEP_ELBOW_ANGLE_DOWN) {
          this.incrementRep();
          this.currentRepCycleState = RepState.START;
          this['alternatingArm'] = 'left';
          this.addFeedback('success', `Alt Curl: Right down, Rep Complete! (Angle: ${rightElbowAngle.toFixed(0)}°)`);
        }
      }
    } else if (this['alternatingArm'] === 'left') {
      if (this.currentRepCycleState === RepState.START) {
        if (leftElbowAngle < this.BICEP_ELBOW_ANGLE_UP) {
          this.currentRepCycleState = RepState.UP;
          this.addFeedback('info', `Alt Curl: Left up phase (Angle: ${leftElbowAngle.toFixed(0)}°)`);
        }
      } else if (this.currentRepCycleState === RepState.UP) {
        if (leftElbowAngle > this.BICEP_ELBOW_ANGLE_DOWN) {
          this.incrementRep();
          this.currentRepCycleState = RepState.START;
          this['alternatingArm'] = 'right';
          this.addFeedback('success', `Alt Curl: Left down, Rep Complete! (Angle: ${leftElbowAngle.toFixed(0)}°)`);
        }
      }
    }
  }

  private analyzeKettlebellSnatch(pose: posedetection.Pose) {
    this.addFeedback('info', 'Snatch: Analyzing (placeholder)...');
    // Placeholder logic - this exercise is complex and requires significant development.
    // Key aspects to consider for a snatch:
    // 1. Phases: Hike, explosive hip drive, pull, high pull/turnover, catch/lockout, lowering.
    // 2. Keypoints: Hips, knees, ankles, shoulders, elbows, wrists.
    // 3. Metrics: Hip/knee extension angles, elbow flexion/extension, wrist path, back posture (e.g., shoulder-hip-knee alignment).
    // 4. Timing: Sequence of joint movements (e.g., hips extend before arm pulls significantly).
    // 5. Velocity: Speed of kettlebell/wrist movement.

    // Example: Very basic check for being somewhat overhead (not a rep counter)
    const rShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const rWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
    if (rShoulder && rWrist && (rShoulder.score ?? 0) > 0.5 && (rWrist.score ?? 0) > 0.5) {
      if (rWrist.y < rShoulder.y - this.SNATCH_ARM_LOCKOUT_SHOULDER_WRIST_ALIGNMENT_Y) {
        // this.addFeedback('info', 'Snatch: Bell appears overhead.');
      }
    }
  }

  private analyzeKettlebellPress(pose: posedetection.Pose) {
    const rShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const rElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
    const rWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
    const rHip = pose.keypoints.find(kp => kp.name === 'right_hip'); // For torso lean check

    if (!rShoulder || !rElbow || !rWrist || !rHip ||
      [rShoulder, rElbow, rWrist, rHip].some(kp => (kp!.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD)) {
      // this.addFeedback('info', 'Press: Keypoints not clear for analysis.');
      return;
    }

    const elbowAngle = this.calculateAngle(rShoulder, rElbow, rWrist);
    if (elbowAngle === null) return;

    // Define press states more explicitly
    // START state for Press means "Racked" position
    // UP state for Press means "Overhead/Lockout" position

    const isOverhead = elbowAngle > this.PRESS_ELBOW_ANGLE_UP && (rWrist.y < rShoulder.y + this.PRESS_WRIST_SHOULDER_Y_DIFF_UP); // wrist Y should be smaller (higher on screen)
    const isRacked = elbowAngle < this.PRESS_ELBOW_ANGLE_RACK && (Math.abs(rWrist.y - rShoulder.y) < this.PRESS_WRIST_SHOULDER_Y_DIFF_RACK + 20); // allow some tolerance

    const stableOverhead = this.isStateStable('press_overhead', isOverhead);
    const stableRacked = this.isStateStable('press_racked', isRacked);

    if (this.currentRepCycleState === RepState.START) { // Expecting RACKED position
      // Transition to UP only when stableOverhead is achieved (lockout is stable)
      if (stableOverhead) {
        this.currentRepCycleState = RepState.UP;
        this.addFeedback('info', `Press: Lockout achieved (Elbow: ${elbowAngle.toFixed(0)}°)`);
        this.lastFramesStates = {};
      }
      // else remain in START (rack) state
    } else if (this.currentRepCycleState === RepState.UP) { // Expecting OVERHEAD, looking to return to RACKED
      if (stableRacked) {
        // Only count rep when returning from lockout to rack
        this.incrementRep();
        this.addFeedback('success', `Press: Rep complete! Returned to rack.`);
        this.currentRepCycleState = RepState.START;
        this.lastFramesStates = {};
      } else if (stableOverhead) {
        // Form checks at lockout
        const wristShoulderXDiff = Math.abs(rWrist.x - rShoulder.x);
        const shoulderHipXDiff = Math.abs(rShoulder.x - rHip.x); // Crude torso lean check
        if (wristShoulderXDiff > this.PRESS_WRIST_SHOULDER_X_ALIGNMENT) {
          this.addFeedback('warning', 'Press: Check wrist/shoulder horizontal alignment at lockout.');
        }
        if (shoulderHipXDiff > this.PRESS_TORSO_LEAN_X_ALIGNMENT) {
          this.addFeedback('warning', 'Press: Possible torso lean at lockout. Stay upright.');
        }
        // No rep counted yet, just holding overhead. Rep counts on return to rack.
      }
    }
  }

  private analyzeGobletSquat(pose: posedetection.Pose) {
    const lHip = pose.keypoints.find(kp => kp.name === 'left_hip');
    const rHip = pose.keypoints.find(kp => kp.name === 'right_hip');
    const lKnee = pose.keypoints.find(kp => kp.name === 'left_knee');
    const rKnee = pose.keypoints.find(kp => kp.name === 'right_knee');
    const lAnkle = pose.keypoints.find(kp => kp.name === 'left_ankle');
    const rAnkle = pose.keypoints.find(kp => kp.name === 'right_ankle');

    if ([lHip, rHip, lKnee, rKnee, lAnkle, rAnkle].some(kp => (kp?.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD)) return;

    const leftKneeAngle = this.calculateAngle(lHip!, lKnee!, lAnkle!);
    const rightKneeAngle = this.calculateAngle(rHip!, rKnee!, rAnkle!);
    if (!leftKneeAngle || !rightKneeAngle) return;

    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    const isDown = avgKneeAngle < 90;
    const isUp = avgKneeAngle > 160;

    const stableDown = this.isStateStable('goblet_down', isDown);
    const stableUp = this.isStateStable('goblet_up', isUp);

    if (this.currentRepCycleState === RepState.START && stableDown) {
      this.currentRepCycleState = RepState.UP;
      this.addFeedback('info', `Squat: Down phase`);
      this.lastFramesStates = {};
    } else if (this.currentRepCycleState === RepState.UP && stableUp) {
      this.incrementRep();
      this.addFeedback('success', 'Squat: Rep complete!');
      this.currentRepCycleState = RepState.START;
      this.lastFramesStates = {};
    }
  }

  private analyzeDeadlift(pose: posedetection.Pose) {
    const lHip = pose.keypoints.find(kp => kp.name === 'left_hip');
    const rHip = pose.keypoints.find(kp => kp.name === 'right_hip');
    const lKnee = pose.keypoints.find(kp => kp.name === 'left_knee');
    const rKnee = pose.keypoints.find(kp => kp.name === 'right_knee');
    const lShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
    const rShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');

    if ([lHip, rHip, lKnee, rKnee, lShoulder, rShoulder].some(kp => (kp?.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD)) return;

    const leftHipAngle = this.calculateAngle(lShoulder!, lHip!, lKnee!);
    const rightHipAngle = this.calculateAngle(rShoulder!, rHip!, rKnee!);
    if (leftHipAngle === null || rightHipAngle === null) return;
    const avgHipAngle = (leftHipAngle + rightHipAngle) / 2;

    const isBottom = avgHipAngle < 90;
    const isTop = avgHipAngle > 160;

    const stableBottom = this.isStateStable('deadlift_bottom', isBottom);
    const stableTop = this.isStateStable('deadlift_top', isTop);

    if (this.currentRepCycleState === RepState.START && stableBottom) {
      this.currentRepCycleState = RepState.UP;
      this.addFeedback('info', 'Deadlift: Bottom position');
      this.lastFramesStates = {};
    } else if (this.currentRepCycleState === RepState.UP && stableTop) {
      this.incrementRep();
      this.addFeedback('success', 'Deadlift: Rep complete!');
      this.currentRepCycleState = RepState.START;
      this.lastFramesStates = {};
    }
  }

  private analyzeKettlebellJerk(pose: posedetection.Pose) {
    const rShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const rElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
    const rWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
    const rHip = pose.keypoints.find(kp => kp.name === 'right_hip');
    const rKnee = pose.keypoints.find(kp => kp.name === 'right_knee');
    const rAnkle = pose.keypoints.find(kp => kp.name === 'right_ankle');

    if ([rShoulder, rElbow, rWrist, rHip, rKnee, rAnkle].some(kp => (kp?.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD)) return;

    const elbowAngle = this.calculateAngle(rShoulder!, rElbow!, rWrist!);
    const kneeAngle = this.calculateAngle(rHip!, rKnee!, rAnkle!);
    const wristOverhead = (rWrist!.y < rShoulder!.y + this.JERK_WRIST_SHOULDER_Y_DIFF_LOCKOUT);
    const wristShoulderXDiff = Math.abs(rWrist!.x - rShoulder!.x);
    const kneeIsDipped = kneeAngle! < this.JERK_KNEE_DIP_ANGLE;
    const kneeIsSecondDip = kneeAngle! < this.JERK_SECOND_DIP_KNEE_ANGLE;

    const stableDip = this.isStateStable('jerk_dip', kneeIsDipped);
    const stableSecondDip = this.isStateStable('jerk_second_dip', kneeIsSecondDip);
    const stableLockout = this.isStateStable('jerk_lockout', elbowAngle! > this.JERK_ELBOW_LOCKOUT_ANGLE && wristOverhead);

    if (this.currentRepCycleState === RepState.START) {
      if (stableDip) {
        this.currentRepCycleState = RepState.UP;
        this.addFeedback('info', 'Jerk: First dip detected (drive).');
        this.lastFramesStates = {};
      }
    } else if (this.currentRepCycleState === RepState.UP) {
      if (stableSecondDip && wristOverhead) {
        this.currentRepCycleState = RepState.UP; // Still UP, but transitioning to lockout
        this.addFeedback('info', 'Jerk: Second dip under bell.');
      }

      if (stableLockout) {
        if (wristShoulderXDiff > this.JERK_WRIST_SHOULDER_X_ALIGNMENT) {
          this.addFeedback('warning', 'Jerk: Check wrist/shoulder alignment at lockout.');
        }
        this.incrementRep();
        this.addFeedback('success', 'Jerk: Rep complete!');
        this.currentRepCycleState = RepState.START;
        this.lastFramesStates = {};
      }
    }
  }



  // --- UTILITY AND HELPER METHODS ---
  private calculateAngle(
    p1: posedetection.Keypoint,
    p2: posedetection.Keypoint, // Vertex of the angle
    p3: posedetection.Keypoint
  ): number | null {
    if (!p1 || !p2 || !p3 || // Ensure keypoints are defined
      (p1.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (p2.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
      (p3.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD) {
      return null; // Not enough confidence or keypoint missing
    }

    const v1x = p1.x - p2.x;
    const v1y = p1.y - p2.y;
    const v2x = p3.x - p2.x;
    const v2y = p3.y - p2.y;

    const dotProduct = v1x * v2x + v1y * v2y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (mag1 === 0 || mag2 === 0) return null; // Avoid division by zero

    const cosineAngle = Math.max(-1, Math.min(1, dotProduct / (mag1 * mag2))); // Clamp for robustness
    return Math.acos(cosineAngle) * (180 / Math.PI); // Convert radians to degrees
  }

  private isStateStable(stateName: string, currentState: boolean): boolean {
    if (!this.lastFramesStates[stateName]) {
      this.lastFramesStates[stateName] = [];
    }
    this.lastFramesStates[stateName].push(currentState);
    if (this.lastFramesStates[stateName].length > this.STABLE_FRAME_COUNT) {
      this.lastFramesStates[stateName].shift(); // Maintain buffer size
    }
    if (this.lastFramesStates[stateName].length < this.STABLE_FRAME_COUNT) {
      return false; // Not enough frames in buffer yet
    }
    // Check if all frames in the buffer match the current desired state
    return this.lastFramesStates[stateName].every(s => s === currentState);
  }

  incrementRep() {
    this.ngZone.run(() => { // Ensure Angular UI updates
      this.repCount++;
      this.addFeedback('success', `Rep ${this.repCount} counted!`);
    });
  }

  addFeedback(type: WorkoutFeedback['type'], message: string) {
    this.ngZone.run(() => {
      const fullMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
      this.feedbackMessages.unshift({ type, message: fullMessage });
      if (this.feedbackMessages.length > 20) { // Increased log size for modal
        this.feedbackMessages.pop();
      }
      this.changeDetectorRef.detectChanges();
    });
  }

  formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // New method to toggle feedback modal visibility
  toggleFeedbackVisibility(): void {
    this.isFeedbackVisible = !this.isFeedbackVisible;
    this.changeDetectorRef.detectChanges();
  }

  // NEW METHOD to toggle controls panel expansion
  toggleControlsExpansion(): void {
    this.isControlsExpanded = !this.isControlsExpanded;
    this.changeDetectorRef.detectChanges(); // Ensure UI updates
  }

  // --- VIDEO RECORDING (Optional) ---
  startRecording() {
    if (!this.videoStream) {
      this.addFeedback('warning', 'No video stream to record.');
      return;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.addFeedback('info', 'Already recording.');
      return;
    }
    try {
      this.recordedChunks = [];
      const mimeTypes = [
        'video/webm; codecs=vp9,opus', 'video/webm; codecs=vp9',
        'video/webm; codecs=vp8,opus', 'video/webm; codecs=vp8',
        'video/mp4', 'video/webm' // Simpler fallbacks
      ];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!supportedMimeType) {
        this.addFeedback('error', 'No supported video format for recording.');
        console.error("No supported MediaRecorder MimeType found from list:", mimeTypes);
        return;
      }
      this.addFeedback('info', `Using recording format: ${supportedMimeType}`);

      this.mediaRecorder = new MediaRecorder(this.videoStream, { mimeType: supportedMimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: supportedMimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a); // Needs to be in DOM to click
        a.style.display = 'none';
        a.href = url;
        const fileExtension = supportedMimeType.includes('mp4') ? 'mp4' : (supportedMimeType.includes('webm') ? 'webm' : 'video');
        a.download = `workout-${new Date().toISOString().replace(/:/g, '-')}.${fileExtension}`;
        a.click();
        window.URL.revokeObjectURL(url); // Clean up
        a.remove();
        this.addFeedback('success', 'Video recording saved.');
        this.isRecording = false;
        this.changeDetectorRef.detectChanges();
      };

      this.mediaRecorder.onerror = (event: Event) => {
        // The event for MediaRecorder error is a generic Event, but might have an error property.
        const errorEvent = event as Event & { error?: DOMException };
        console.error("MediaRecorder error:", errorEvent.error || event);
        this.addFeedback('error', `Recording error: ${errorEvent.error?.name || 'Unknown error'}`);
        this.isRecording = false;
        this.changeDetectorRef.detectChanges();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.addFeedback('info', 'Recording started.');
      this.changeDetectorRef.detectChanges();
    } catch (e) {
      console.error('Error starting recording:', e);
      this.addFeedback('error', `Failed to start recording: ${e instanceof Error ? e.message : String(e)}`);
      this.isRecording = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop(); // onstop handler will do the rest
      this.addFeedback('info', 'Stopping recording...');
    } else {
      this.addFeedback('info', 'Not currently recording.');
      if (this.isRecording) { // Correct state if somehow out of sync
        this.isRecording = false;
        this.changeDetectorRef.detectChanges();
      }
    }
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  private initializeFabPosition(): void {
    // Initial position: bottom-right corner with some padding
    // We need to wait for the view to be initialized to get viewport dimensions reliably
    // or calculate based on the component's host element if it fills the viewport.

    // A simple way is to set it relative to viewport size initially.
    // This might need adjustment if your layout is complex.
    const padding = 20; // pixels from edge
    const fabSize = 56; // pixels (same as in SCSS)

    // Using window dimensions for initial placement.
    // For more robustness within an Angular component that might not fill the screen,
    // you'd get the dimensions of a known parent container.
    this.fabPosition.x = window.innerWidth - fabSize - padding;
    this.fabPosition.y = window.innerHeight - fabSize - padding;

    // If you need the FAB's own dimensions (e.g., if it's not fixed size)
    // you'd typically query it after view init:
    // ngAfterViewInit() {
    //   const fabButton = this.hostElement.nativeElement.querySelector('.controls-fab') as HTMLElement;
    //   if (fabButton) {
    //     this.fabElementRef = new ElementRef(fabButton);
    //     // Now you can use this.fabElementRef.nativeElement.offsetWidth, etc.
    //     // And then set initial position.
    //     this.fabPosition.x = window.innerWidth - fabButton.offsetWidth - padding;
    //     this.fabPosition.y = window.innerHeight - fabButton.offsetHeight - padding;
    //     this.changeDetectorRef.detectChanges(); // Update view with initial position
    //   }
    // }
  }


  onFabMouseDown(event: MouseEvent): void {
    // Only start dragging if the user is actually trying to drag (not just a click)
    // Only respond to left mouse button (button === 0)
    if (event.button !== 0) return;

    // Ignore simple clicks: only start dragging if the user moves the mouse (handled in mousemove)
    // Here, we just record the initial position and set a flag to indicate a drag may start.
    event.preventDefault(); // Prevent text selection during drag
    this.isFabDragging = false; // Will be set to true on actual drag
    const fabButton = event.currentTarget as HTMLElement;
    const fabRect = fabButton.getBoundingClientRect();

    // Store initial mouse position and FAB offset for drag threshold
    this.fabDragStartOffset.x = event.clientX - fabRect.left;
    this.fabDragStartOffset.y = event.clientY - fabRect.top;

    // Set up a temporary mousemove and mouseup listener to detect drag threshold
    const dragThreshold = 5; // pixels
    const initialX = event.clientX;
    const initialY = event.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - initialX;
      const dy = moveEvent.clientY - initialY;
      if (!this.isFabDragging && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
        this.isFabDragging = true;
      }
      if (this.isFabDragging) {
        this.updateFabPosition(moveEvent.clientX, moveEvent.clientY);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.isFabDragging = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  onFabTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return; // Only single touch drag
    event.preventDefault(); // Prevent page scroll during drag on touch devices
    this.isFabDragging = false; // Will be set to true after drag threshold is passed
    const fabButton = event.currentTarget as HTMLElement;
    const fabRect = fabButton.getBoundingClientRect();
    const touch = event.touches[0];

    this.fabDragStartOffset.x = touch.clientX - fabRect.left;
    this.fabDragStartOffset.y = touch.clientY - fabRect.top;

    const dragThreshold = 5; // pixels
    const initialX = touch.clientX;
    const initialY = touch.clientY;

    let moved = false;

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      const moveTouch = moveEvent.touches[0];
      const dx = moveTouch.clientX - initialX;
      const dy = moveTouch.clientY - initialY;
      if (!this.isFabDragging && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
        this.isFabDragging = true;
        moved = true;
      }
      if (this.isFabDragging) {
        this.updateFabPosition(moveTouch.clientX, moveTouch.clientY);
      }
    };

    const onTouchEnd = () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      if (!moved) {
        // Considered a tap, not a drag
        this.toggleControlsExpansion();
      }
      this.isFabDragging = false;
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
  }

  // Listen for mousemove and mouseup on the whole document
  // This ensures dragging continues even if the mouse leaves the FAB itself,
  // and that dragging stops when the mouse button is released anywhere.
  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isFabDragging) return;
    event.preventDefault();
    this.updateFabPosition(event.clientX, event.clientY);
  }

  @HostListener('document:touchmove', ['$event'])
  onDocumentTouchMove(event: TouchEvent): void {
    if (!this.isFabDragging || event.touches.length !== 1) return;
    // event.preventDefault(); // Removed to avoid passive event listener error
    const touch = event.touches[0];
    this.updateFabPosition(touch.clientX, touch.clientY);
  }

  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseUp(event: MouseEvent): void {
    if (this.isFabDragging) {
      this.isFabDragging = false;
      // Optional: Snap to edges or save position here
    }
  }

  @HostListener('document:touchend', ['$event'])
  onDocumentTouchEnd(event: TouchEvent): void {
    if (this.isFabDragging) {
      this.isFabDragging = false;
      // Optional: Snap to edges or save position here
    }
  }

  private updateFabPosition(clientX: number, clientY: number): void {
    const hostRect = this.hostElement.nativeElement.getBoundingClientRect();
    const fabSize = 56; // Assuming fixed size from SCSS, or get from this.fabElementRef

    // Calculate new top-left position for the FAB
    let newX = clientX - this.fabDragStartOffset.x - hostRect.left;
    let newY = clientY - this.fabDragStartOffset.y - hostRect.top;

    // Constrain FAB within the bounds of the host element (workout-tracker-container)
    newX = Math.max(0, Math.min(newX, hostRect.width - fabSize));
    newY = Math.max(0, Math.min(newY, hostRect.height - fabSize));

    this.fabPosition = { x: newX, y: newY };
    // No need for changeDetectorRef.detectChanges() here as Angular's event binding
    // and property updates will trigger change detection for style bindings.
  }
}