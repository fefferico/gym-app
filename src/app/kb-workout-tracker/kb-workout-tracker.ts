import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, inject, NgZone } from '@angular/core';
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
  private KEYPOINT_SCORE_THRESHOLD = 0.4; // Min confidence for a keypoint
  private STABLE_FRAME_COUNT = 2; // Number of consecutive frames for state debounce
  private lastFramesStates: { [key: string]: boolean[] } = {}; // Debounce history

  // Bicep Curl
  private BICEP_ELBOW_ANGLE_UP = 70;    // Degrees, arm flexed
  private BICEP_ELBOW_ANGLE_DOWN = 150; // Degrees, arm extended
  private BICEP_WRIST_ELBOW_VERTICAL_DIFF_DOWN = -10; // Pixels: wrist Y vs elbow Y at bottom

  // Kettlebell Snatch (very rough placeholders)
  private SNATCH_HIP_EXTENSION_ANGLE_START = 160;
  private SNATCH_ARM_LOCKOUT_SHOULDER_WRIST_ALIGNMENT_Y = 20;
  private SNATCH_KNEE_ANGLE_BOTTOM = 90;

  // Kettlebell Press
  private PRESS_ELBOW_ANGLE_UP = 160; // Arm fully extended
  private PRESS_ELBOW_ANGLE_RACK = 90; // Elbow bent at rack position
  private PRESS_WRIST_SHOULDER_Y_DIFF_UP = -20; // Wrist Y higher than shoulder Y at lockout
  private PRESS_WRIST_SHOULDER_Y_DIFF_RACK = 10; // Wrist Y relative to shoulder Y at rack
  private PRESS_WRIST_SHOULDER_X_ALIGNMENT = 40; // Max horizontal diff for wrist/shoulder alignment
  private PRESS_TORSO_LEAN_X_ALIGNMENT = 50;   // Max horizontal diff for shoulder/hip alignment (lean check)
  private lastRepTime = -1; // Helper for demo rep counter, can be removed if not using timed demo reps

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
  }

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
              this.addFeedback('error', "Could not start video playback.");
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
    } else if (exerciseName === 'Kettlebell Snatch') {
      this.exerciseSpecificLogic = this.analyzeKettlebellSnatch;
    } else if (exerciseName === 'Kettlebell Press') {
      this.exerciseSpecificLogic = this.analyzeKettlebellPress;
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
    const rShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const rElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
    const rWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');

    if (!rShoulder || !rElbow || !rWrist ||
        [rShoulder, rElbow, rWrist].some(kp => (kp!.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD)) {
      // this.addFeedback('info', 'Curl: Right arm keypoints not clear.'); // Optional: too much feedback can be noisy
      return;
    }

    const elbowAngle = this.calculateAngle(rShoulder, rElbow, rWrist);
    if (elbowAngle === null) return;

    const isArmUp = elbowAngle < this.BICEP_ELBOW_ANGLE_UP;
    const isArmDown = elbowAngle > this.BICEP_ELBOW_ANGLE_DOWN;

    const stableArmUp = this.isStateStable('bicep_arm_up', isArmUp);
    const stableArmDown = this.isStateStable('bicep_arm_down', isArmDown);

    const wristVsElbowVertical = rWrist.y - rElbow.y;
    const isWristPositionCorrectDown = wristVsElbowVertical > this.BICEP_WRIST_ELBOW_VERTICAL_DIFF_DOWN;

    if (this.currentRepCycleState === RepState.START) {
      if (stableArmUp) {
        this.currentRepCycleState = RepState.UP;
        this.addFeedback('info', `Curl: Up phase (Angle: ${elbowAngle.toFixed(0)}°)`);
        this.lastFramesStates = {}; // Clear debounce for next state part
      }
    } else if (this.currentRepCycleState === RepState.UP) {
      if (stableArmDown) {
        if (isWristPositionCorrectDown) {
          this.incrementRep();
          this.addFeedback('success', `Curl: Rep Complete!`);
        } else {
          this.addFeedback('warning', `Curl: Rep done, but check wrist position at bottom next time.`);
        }
        this.currentRepCycleState = RepState.START;
        this.lastFramesStates = {};
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
      // Check if moving towards overhead from a racked-like position
      if (isOverhead && !stableOverhead && elbowAngle > (this.PRESS_ELBOW_ANGLE_RACK + 10)) { // elbow extending
        this.currentRepCycleState = RepState.UP;
        this.addFeedback('info', `Press: Pressing up (Elbow: ${elbowAngle.toFixed(0)}°)`);
        this.lastFramesStates = {};
      } else if (stableRacked) {
        // this.addFeedback('info', `Press: Ready at rack (Elbow: ${elbowAngle.toFixed(0)}°)`);
        // No state change yet, just confirming racked position
      }
    } else if (this.currentRepCycleState === RepState.UP) { // Expecting OVERHEAD, looking to return to RACKED
      if (stableRacked) {
        // Form check should ideally happen at the point of stableOverhead in previous cycle.
        // For simplicity here, we'll assume the form was good if it reached UP state.
        // A more advanced approach would store form metrics when UP state was achieved.
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

  toggleFeedbackVisibility(): void {
    this.isFeedbackVisible = !this.isFeedbackVisible;
    this.changeDetectorRef.detectChanges(); // UI update for modal visibility
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
}