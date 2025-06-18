import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

// TensorFlow.js and Pose Detection
import * as posedetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl'; // Preferred backend for performance
import { FormsModule } from '@angular/forms';
// import '@tensorflow/tfjs-backend-cpu'; // Fallback or for environments without WebGL

interface WorkoutFeedback {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

enum RepState {
  START = 'START', // Or 'DOWN' for bicep curl
  UP = 'UP',
  // You might add more states for complex exercises
}

interface ExerciseConfig {
  name: string;
  keypoints: string[]; // Names of essential keypoints
  analyzer: (pose: posedetection.Pose, component: KettleBellWorkoutTrackerComponent) => void;
  thresholds: { [key: string]: number };
  initialState: RepState;
}

@Component({
  selector: 'app-workout-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kb-workout-tracker.html',
  styleUrls: ['./kb-workout-tracker.scss']
})
export class KettleBellWorkoutTrackerComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElementRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElementRef!: ElementRef<HTMLCanvasElement>;

  protected videoStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private poseDetector: posedetection.PoseDetector | null = null;
  modelReady = false; // Public so template can access it for UI feedback

  isCameraReady = false;
  isRecording = false;
  isWorkoutActive = false;
  repCount = 0;
  elapsedTime = 0;
  timerInterval: any;

  feedbackMessages: WorkoutFeedback[] = [];
  // currentExercise = 'Kettlebell Snatch'; // Example, could be an @Input

  private changeDetectorRef = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private animationFrameId: number | null = null;

  // New properties for exercise state tracking

  // New properties for exercise state tracking
  private currentRepCycleState: RepState = RepState.START;

  // CORRECTED TYPE for exerciseSpecificLogic:
  private exerciseSpecificLogic: ((pose: posedetection.Pose) => void) | null = null;

  public currentExercise = 'Right Bicep Curl';

  // --- THRESHOLDS (CRITICAL FOR TUNING) ---
  // Bicep Curl
  private BICEP_ELBOW_ANGLE_UP = 70;    // Degrees, arm flexed
  private BICEP_ELBOW_ANGLE_DOWN = 150; // Degrees, arm extended
  private BICEP_WRIST_ELBOW_VERTICAL_DIFF_DOWN = -10; // Pixels: wrist should ideally not be much HIGHER than elbow at bottom (negative means wrist is lower or same)
  // This is sensitive to camera angle!

  // General
  private KEYPOINT_SCORE_THRESHOLD = 0.4; // Min confidence for a keypoint
  private STABLE_FRAME_COUNT = 2; // Number of consecutive frames a condition must hold for state change (debounce)
  private lastFramesStates: { [key: string]: boolean[] } = {}; // For debouncing

  // Kettlebell Snatch (very rough placeholders, will need significant work)
  private SNATCH_HIP_EXTENSION_ANGLE_START = 160; // Hip relatively straight at start of pull
  private SNATCH_ARM_LOCKOUT_SHOULDER_WRIST_ALIGNMENT_Y = 20; // Pixels: wrist Y should be close to shoulder Y at lockout
  private SNATCH_KNEE_ANGLE_BOTTOM = 90; // Approx knee angle at bottom


  async ngOnInit() {
    this.addFeedback('info', 'Initializing TensorFlow.js backend...');
    try {
      await tf.setBackend('webgl');
      await tf.ready(); // Ensure backend is ready
      this.addFeedback('info', `TensorFlow.js backend set to: ${tf.getBackend()}`);
    } catch (e) {
      console.error("Error setting TF backend:", e);
      this.addFeedback('error', `Error setting TF backend: ${e}`);
      // Fallback or further error handling
      try {
        await tf.setBackend('cpu');
        await tf.ready();
        this.addFeedback('warning', `Fell back to TF.js backend: ${tf.getBackend()}`);
      } catch (cpuError) {
        this.addFeedback('error', `CPU backend also failed: ${cpuError}`);
        return; // Critical failure
      }
    }

    await this.setupCamera();
    await this.loadPoseDetectionModel();
    this.setExerciseLogic(this.currentExercise); // Set logic after model is potentially ready
  }

  ngOnDestroy() {
    this.stopWorkout(); // Stops animation frame too
    this.stopCamera();
    if (this.poseDetector) {
      this.poseDetector.dispose();
      this.addFeedback('info', 'Pose detection model disposed.');
      this.poseDetector = null;
    }
  }

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

              // Set canvas dimensions once video is ready and playing
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
        this.isCameraReady = false; // Explicitly set
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.addFeedback('error', `Error accessing camera: ${error instanceof Error ? error.message : String(error)}`);
      if ((error as any).name === 'NotAllowedError') {
        this.addFeedback('warning', 'Camera permission denied. Please allow camera access.');
      }
      this.isCameraReady = false; // Explicitly set
    }
    this.changeDetectorRef.detectChanges();
  }

  async loadPoseDetectionModel() {
    if (this.poseDetector) {
      this.poseDetector.dispose();
      this.poseDetector = null;
    }
    this.modelReady = false;
    this.addFeedback('info', 'Loading pose detection model (MoveNet Lightning)...');
    this.changeDetectorRef.detectChanges(); // Show loading message

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
      this.addFeedback('error', `Could not load AI model: ${error}`);
      this.modelReady = false;
    } finally {
      this.changeDetectorRef.detectChanges();
    }
  }

  startWorkout() {
    if (!this.isCameraReady) {
      this.addFeedback('warning', 'Camera not ready.');
      return;
    }
    if (!this.modelReady || !this.poseDetector) {
      this.addFeedback('warning', 'AI Model not ready. Please wait or try reloading model.');
      // Optionally offer to reload model:
      // if (!this.modelReady) { this.loadPoseDetectionModel(); }
      return;
    }

    this.isWorkoutActive = true;
    this.repCount = 0;
    this.elapsedTime = 0;
    this.lastRepTime = -1; // Reset for demo rep counter if used
    this.feedbackMessages = [{ type: 'success', message: 'Workout started! Form tracking active.' }];
    this.changeDetectorRef.detectChanges();

    this.timerInterval = setInterval(() => {
      this.elapsedTime++;
      this.changeDetectorRef.detectChanges();
    }, 1000);

    if (this.animationFrameId) {
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

    // Clear canvas
    const canvas = this.canvasElementRef?.nativeElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    this.changeDetectorRef.detectChanges();

    // Optional: Stop recording
    // this.stopRecording();
  }

  private processVideoFrame = async () => {
    if (!this.isWorkoutActive || !this.videoElementRef || !this.canvasElementRef || !this.poseDetector || !this.modelReady) {
      // If still supposed to be active but something is wrong, attempt to re-request frame,
      // but be cautious of infinite loops if a resource never becomes ready.
      if (this.isWorkoutActive) {
        this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
      }
      return;
    }

    const video = this.videoElementRef.nativeElement;
    const canvas = this.canvasElementRef.nativeElement;

    // Ensure video is ready to provide frames
    if (video.readyState < video.HAVE_CURRENT_DATA) { // HAVE_CURRENT_DATA = 2
      this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
      return;
    }

    try {
      // Ensure canvas dimensions match video in case of resize or delayed load
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          // Video dimensions not yet available, skip this frame
          this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
          return;
        }
      }

      const poses = await this.poseDetector.estimatePoses(video, {
        flipHorizontal: false // Set to true if your camera feed is mirrored and you want unmirrored poses
      });

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous frame

        if (poses && poses.length > 0) {
          const pose = poses[0]; // Assuming single pose detection
          this.drawPose(pose.keypoints, ctx);

          // --- FORM CHECKING & REP COUNTING LOGIC (Placeholder) ---
          this.analyzePoseForReps(pose);
          // ---
        }
      }
    } catch (error) {
      console.error("Error during pose estimation or drawing:", error);
      this.addFeedback('error', 'AI processing error. Workout may be affected.');
      // Consider stopping workout or providing more specific error handling
    }

    // Continue the loop only if the workout is still active
    if (this.isWorkoutActive) {
      this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
    }
  }

  private lastRepTime = -1; // Helper for demo rep counter

  private drawPose(keypoints: posedetection.Keypoint[], ctx: CanvasRenderingContext2D) {
    const minConfidence = 0.3; // Minimum score to draw a keypoint or link

    // Draw keypoints
    ctx.fillStyle = 'aqua'; // Color for keypoints
    for (const keypoint of keypoints) {
      if (keypoint.score != null && keypoint.score >= minConfidence) {
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw skeleton lines (connections)
    // MoveNet model has a predefined set of adjacent keypoint pairs for drawing the skeleton.
    const adjacentPairs = posedetection.util.getAdjacentPairs(posedetection.SupportedModels.MoveNet);
    ctx.strokeStyle = 'lime'; // Color for skeleton lines
    ctx.lineWidth = 3;

    for (const [kp1Index, kp2Index] of adjacentPairs) {
      const kp1 = keypoints[kp1Index];
      const kp2 = keypoints[kp2Index];

      if (kp1 && kp2 && kp1.score != null && kp1.score >= minConfidence && kp2.score != null && kp2.score >= minConfidence) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    }
  }

  incrementRep() {
    // This should ideally be called from analyzePoseForReps after a valid rep is detected
    this.ngZone.run(() => { // Ensure rep count updates Angular's view
      this.repCount++;
      this.addFeedback('success', `Rep ${this.repCount} counted!`);
      // this.changeDetectorRef.detectChanges(); // addFeedback already calls it
    });
  }

  stopCamera() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    if (this.videoElementRef && this.videoElementRef.nativeElement.srcObject) {
      this.videoElementRef.nativeElement.srcObject = null;
    }
    this.isCameraReady = false;
    this.changeDetectorRef.detectChanges();
  }

  // --- Optional Video Recording ---
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
      // Try common mimeTypes, browser will pick the first supported one
      const mimeTypes = [
        'video/webm; codecs=vp9,opus',
        'video/webm; codecs=vp9',
        'video/webm; codecs=vp8,opus',
        'video/webm; codecs=vp8',
        'video/mp4; codecs=h264,aac', // Less likely to be supported for MediaRecorder directly
        'video/webm'
      ];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!supportedMimeType) {
        this.addFeedback('error', 'No supported video format for recording.');
        console.error("No supported MediaRecorder MimeType found");
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
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        const fileExtension = supportedMimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `workout-${new Date().toISOString().replace(/:/g, '-')}.${fileExtension}`;
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        this.addFeedback('success', 'Video recording saved.');
        this.isRecording = false;
        this.changeDetectorRef.detectChanges();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        this.addFeedback('error', `Recording error: ${(event as any).error?.name}`);
        this.isRecording = false;
        this.changeDetectorRef.detectChanges();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.addFeedback('info', 'Recording started.');
      this.changeDetectorRef.detectChanges();
    } catch (e) {
      console.error('Error starting recording:', e);
      this.addFeedback('error', `Failed to start recording: ${e}`);
      this.isRecording = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      // onstop handler will set isRecording to false and save
      this.addFeedback('info', 'Stopping recording...');
    } else {
      this.addFeedback('info', 'Not currently recording.');
      this.isRecording = false; // Ensure state is correct
      this.changeDetectorRef.detectChanges();
    }
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }
  // --- End Optional Video Recording ---

  addFeedback(type: WorkoutFeedback['type'], message: string) {
    // Using NgZone.run to ensure changes are picked up by Angular,
    // especially if this method is called from callbacks outside Angular's zone.
    this.ngZone.run(() => {
      const fullMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
      this.feedbackMessages.unshift({ type, message: fullMessage });
      if (this.feedbackMessages.length > 10) { // Limit number of messages
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

  // Add this new method to set exercise-specific logic
  setExerciseLogic(exerciseName: string) {
    this.currentRepCycleState = RepState.START;
    this.repCount = 0;
    this.lastFramesStates = {}; // Reset debounce history
    this.addFeedback('info', `Switched to exercise: ${exerciseName}`);

    this.currentExercise = exerciseName; // Set it regardless, so UI updates

    if (exerciseName === 'Right Bicep Curl') {
      this.exerciseSpecificLogic = this.analyzeRightBicepCurl;
    } else if (exerciseName === 'Kettlebell Snatch') {
      this.exerciseSpecificLogic = this.analyzeKettlebellSnatch;
    } else if (exerciseName === 'Kettlebell Press') {
      this.exerciseSpecificLogic = this.analyzeKettlebellPress;
    }
    // Add more exercises here with 'else if'
    else {
      this.addFeedback('warning', `No specific logic for exercise: ${exerciseName}`);
      this.exerciseSpecificLogic = null;
    }
    this.changeDetectorRef.detectChanges();
  }


  // Helper function to calculate angle between three points
  private calculateAngle(
    p1: posedetection.Keypoint,
    p2: posedetection.Keypoint, // Vertex of the angle
    p3: posedetection.Keypoint
  ): number | null {
    if (
      p1.score == null || p1.score < this.KEYPOINT_SCORE_THRESHOLD ||
      p2.score == null || p2.score < this.KEYPOINT_SCORE_THRESHOLD ||
      p3.score == null || p3.score < this.KEYPOINT_SCORE_THRESHOLD
    ) {
      return null; // Not enough confidence in keypoints
    }

    // Calculate vectors
    const v1x = p1.x - p2.x;
    const v1y = p1.y - p2.y;
    const v2x = p3.x - p2.x;
    const v2y = p3.y - p2.y;

    // Calculate dot product
    const dotProduct = v1x * v2x + v1y * v2y;

    // Calculate magnitudes
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (mag1 === 0 || mag2 === 0) {
      return null; // Avoid division by zero
    }

    // Calculate cosine of the angle
    const cosineAngle = dotProduct / (mag1 * mag2);

    // Ensure cosineAngle is within [-1, 1] due to potential floating point inaccuracies
    const angleRad = Math.acos(Math.max(-1, Math.min(1, cosineAngle)));

    // Convert to degrees
    return angleRad * (180 / Math.PI);
  }

  // Main analysis function called from processVideoFrame
  private analyzePoseForReps(pose: posedetection.Pose) {
    if (this.exerciseSpecificLogic) {
      // CORRECTED CALL:
      // Since analyzeRightBicepCurl is already bound to 'this' (as it's a class method),
      // and exerciseSpecificLogic now correctly expects 'pose', you can call it directly.
      // .call(this, pose) would also work but is slightly more verbose than necessary here.
      this.exerciseSpecificLogic.call(this, pose);
    }
  }

  // --- BICEP CURL LOGIC ---
  private analyzeRightBicepCurl(pose: posedetection.Pose) {
    const rShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const rElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
    const rWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');

    if (!rShoulder || !rElbow || !rWrist ||
        (rShoulder.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
        (rElbow.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD ||
        (rWrist.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD) {
      // this.addFeedback('warning', 'Curl: Right arm keypoints not clearly visible or low confidence.');
      return;
    }

    const elbowAngle = this.calculateAngle(rShoulder, rElbow, rWrist);
    if (elbowAngle === null) return;

    const isArmUp = elbowAngle < this.BICEP_ELBOW_ANGLE_UP;
    const isArmDown = elbowAngle > this.BICEP_ELBOW_ANGLE_DOWN;

    const stableArmUp = this.isStateStable('bicep_arm_up', isArmUp);
    const stableArmDown = this.isStateStable('bicep_arm_down', isArmDown);

    // Wrist position check (example: wrist should not be significantly higher than elbow at bottom)
    // Positive Y is typically downwards in screen/image coordinates.
    const wristVsElbowVertical = rWrist.y - rElbow.y;
    const isWristPositionCorrectDown = wristVsElbowVertical > this.BICEP_WRIST_ELBOW_VERTICAL_DIFF_DOWN;
    // this.addFeedback('info', `Elbow: ${elbowAngle.toFixed(0)}, WristY-ElbowY: ${wristVsElbowVertical.toFixed(0)}`);


    if (this.currentRepCycleState === RepState.START) {
      if (stableArmUp) {
        this.currentRepCycleState = RepState.UP;
        this.addFeedback('info', `Curl: Up phase (Angle: ${elbowAngle.toFixed(0)}°)`);
        this.lastFramesStates = {}; // Clear debounce for next state
      } else if (isArmDown && !isWristPositionCorrectDown) {
        // this.addFeedback('warning', 'Curl: Check wrist position at bottom.');
      }
    } else if (this.currentRepCycleState === RepState.UP) {
      if (stableArmDown) {
        if (isWristPositionCorrectDown) { // Check form on completion
          this.incrementRep();
          this.addFeedback('success', `Curl: Rep Complete! (Angle: ${elbowAngle.toFixed(0)}°)`);
        } else {
          this.addFeedback('warning', `Curl: Rep done, but check wrist position at bottom next time.`);
        }
        this.currentRepCycleState = RepState.START;
        this.lastFramesStates = {}; // Clear debounce for next state
      }
      // Add feedback if user is stuck in "up" but not fully down, e.g.
      // else if (!isArmUp && elbowAngle < (this.BICEP_ELBOW_ANGLE_DOWN - 20)) { // Not fully down, not fully up
      //   this.addFeedback('info', `Curl: Extend arm fully to complete rep.`);
      // }
    }

    // Conceptual Elbow Drift Check:
    // 1. When state becomes UP, store rElbow.x relative to rShoulder.x
    // 2. While in UP state, if rElbow.x deviates too much from stored initial, provide feedback.
    // This requires storing state across frames within the exercise logic.
  }

  // --- KETTLEBELL SNATCH LOGIC (VERY BASIC OUTLINE) ---
  private analyzeKettlebellSnatch(pose: posedetection.Pose) {
    this.addFeedback('info', 'Snatch: Analyzing...');

    const rShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const rElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
    const rWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
    const rHip = pose.keypoints.find(kp => kp.name === 'right_hip');
    const rKnee = pose.keypoints.find(kp => kp.name === 'right_knee');
    const rAnkle = pose.keypoints.find(kp => kp.name === 'right_ankle');
    // Consider nose or an ear for head position/posture.
    // For symmetry, you might average left and right keypoints if doing a two-handed movement or want general posture.

    if (!rShoulder || !rElbow || !rWrist || !rHip || !rKnee || !rAnkle ||
        [rShoulder, rElbow, rWrist, rHip, rKnee, rAnkle].some(kp => (kp?.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD)) {
      this.addFeedback('warning', 'Snatch: Key body parts not clearly visible.');
      return;
    }

    // Calculate relevant angles
    const hipAngle = this.calculateAngle(rShoulder, rHip, rKnee); // Hip extension/flexion
    const kneeAngle = this.calculateAngle(rHip, rKnee, rAnkle);   // Knee extension/flexion
    const elbowAngle = this.calculateAngle(rShoulder, rElbow, rWrist); // Arm position

    if (hipAngle === null || kneeAngle === null || elbowAngle === null) {
        this.addFeedback('info', 'Snatch: Could not calculate key angles.');
        return;
    }

    // Snatch States (example, needs to be much more granular):
    // RepState.START -> Bottom of swing / initial dip
    // RepState.PULLING -> Hip extension, KB travelling up
    // RepState.CATCHING -> Arm punching through, KB turnover
    // RepState.UP (or LOCKOUT) -> KB overhead, stable
    // (Then a sequence for lowering the bell)

    // Example transition (VERY simplified)
    if (this.currentRepCycleState === RepState.START) {
        // Looking for bottom position (e.g., knees bent, hips hinged)
        // AND THEN a move towards hip extension
        const isBottomPosition = kneeAngle < this.SNATCH_KNEE_ANGLE_BOTTOM + 20 && hipAngle < 120; // Example values
        const isHipExtending = hipAngle > this.SNATCH_HIP_EXTENSION_ANGLE_START - 30; // Moving towards straight

        if (this.isStateStable('snatch_bottom', isBottomPosition)) {
            // Now wait for hip extension from this stable bottom
        }

        if (isBottomPosition && isHipExtending && rWrist.y > rHip.y) { // KB still low, but hips are opening
            // This is too simple, just an idea for a trigger
            // A real snatch relies on timing and velocity which is hard with static poses.
            // You might look for rWrist moving upwards rapidly after hip extension.
            // this.currentRepCycleState = "PULLING"; // Define more states
            this.addFeedback('info', `Snatch: Hip drive detected (Hip: ${hipAngle.toFixed(0)}°)`);
            // Reset debounce for next phase
        }
    } else if (this.currentRepCycleState === RepState.UP) { // Assuming UP is lockout
        // Looking for bell to come down to START a new rep
        const isArmLowering = elbowAngle > 90 && rWrist.y > rShoulder.y; // Bell coming down
        if (this.isStateStable('snatch_lowering', isArmLowering) && kneeAngle < this.SNATCH_KNEE_ANGLE_BOTTOM + 30) {
            this.incrementRep();
            this.currentRepCycleState = RepState.START;
            this.addFeedback('success', `Snatch: Rep Complete (placeholder).`);
            // Reset debounce for next phase
        }
    }

    // Form Checks for Snatch (Examples):
    // - Back straightness: Angle between shoulder, hip, and knee (should be relatively straight during pull).
    // - KB path: Wrist should stay relatively close to the body during the pull.
    // - Lockout: Elbow fully extended, wrist stacked over shoulder, KB stable (minimal wrist movement).
    // - Smooth catch: Avoid the KB crashing onto the forearm (hard to detect without impact sensors, but abrupt wrist/elbow angle changes might hint).
    // - Timing: Hip extension should precede arm pull.

    // this.addFeedback('info', `Snatch Angles - Hip:${hipAngle.toFixed(0)}, Knee:${kneeAngle.toFixed(0)}, Elbow:${elbowAngle.toFixed(0)}`);
  }

  /**
   * Analyze a right-arm kettlebell press (strict press, not push press).
   * Detects a rep when the arm moves from a "down" (elbow flexed, wrist below shoulder) to "up" (elbow extended, wrist above shoulder) position.
   * Form checks: elbow lockout at top, wrist stacked over shoulder, minimal torso lean.
   */
  private analyzeKettlebellPress(pose: posedetection.Pose) {
    const rShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const rElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
    const rWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
    const rHip = pose.keypoints.find(kp => kp.name === 'right_hip');

    if (!rShoulder || !rElbow || !rWrist || !rHip ||
        [rShoulder, rElbow, rWrist, rHip].some(kp => (kp?.score ?? 0) < this.KEYPOINT_SCORE_THRESHOLD)) {
      // Not enough confidence in keypoints
      return;
    }

    // Calculate elbow angle (shoulder-elbow-wrist)
    const elbowAngle = this.calculateAngle(rShoulder, rElbow, rWrist);
    if (elbowAngle === null) return;

    // "Up" = arm extended, wrist above shoulder
    const isArmUp = elbowAngle > 155 && rWrist.y < rShoulder.y - 10;
    // "Down" = elbow flexed, wrist below shoulder
    const isArmDown = elbowAngle < 110 && rWrist.y > rShoulder.y + 10;

    const stableArmUp = this.isStateStable('press_arm_up', isArmUp);
    const stableArmDown = this.isStateStable('press_arm_down', isArmDown);

    if (this.currentRepCycleState === RepState.START) {
      if (stableArmDown) {
        this.addFeedback('info', `Press: Ready at bottom (elbow: ${elbowAngle.toFixed(0)}°)`);
        this.currentRepCycleState = RepState.UP;
        this.lastFramesStates = {};
      }
    } else if (this.currentRepCycleState === RepState.UP) {
      if (stableArmUp) {
        // Form check: wrist stacked over shoulder (x close), torso upright (shoulder and hip x close)
        const wristShoulderXDiff = Math.abs(rWrist.x - rShoulder.x);
        const shoulderHipXDiff = Math.abs(rShoulder.x - rHip.x);
        if (wristShoulderXDiff < 30 && shoulderHipXDiff < 40) {
          this.incrementRep();
          this.addFeedback('success', `Press: Rep complete! (elbow: ${elbowAngle.toFixed(0)}°)`);
        } else {
          this.addFeedback('warning', 'Press: Check wrist/shoulder alignment or torso lean at lockout.');
        }
        this.currentRepCycleState = RepState.START;
        this.lastFramesStates = {};
      }
    }
  }



  // You would add more analyze... methods for other exercises
  // private analyzeKettlebellSnatch(pose: posedetection.Pose) {
  //   this.addFeedback('info', 'Kettlebell Snatch analysis placeholder.');
  //   // Complex logic involving multiple keypoints, velocities, and states
  // }


  // ... (rest of the component: incrementRep, drawPose, stopCamera, recording, addFeedback, formatTime)
  // Make sure incrementRep is called like this:
  // incrementRep() {
  //   this.ngZone.run(() => {
  //       this.repCount++;
  //       this.addFeedback('success', `Rep ${this.repCount} counted!`);
  //   });
  // }

  // Helper: Debounce state changes
  private isStateStable(stateName: string, currentState: boolean): boolean {
    if (!this.lastFramesStates[stateName]) {
      this.lastFramesStates[stateName] = [];
    }
    this.lastFramesStates[stateName].push(currentState);
    if (this.lastFramesStates[stateName].length > this.STABLE_FRAME_COUNT) {
      this.lastFramesStates[stateName].shift(); // Keep buffer size
    }
    if (this.lastFramesStates[stateName].length < this.STABLE_FRAME_COUNT) {
      return false; // Not enough frames yet
    }
    return this.lastFramesStates[stateName].every(s => s === currentState);
  }
}