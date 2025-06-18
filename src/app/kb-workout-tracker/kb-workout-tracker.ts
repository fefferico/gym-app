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

  // Thresholds (these will need significant tuning!)
  private ELBOW_ANGLE_UP_THRESHOLD = 70;
  private ELBOW_ANGLE_DOWN_THRESHOLD = 150;
  private KEYPOINT_SCORE_THRESHOLD = 0.4;


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
    this.addFeedback('info', `Switched to exercise: ${exerciseName}`);

    if (exerciseName === 'Right Bicep Curl') {
      this.currentExercise = exerciseName;
      // Assign directly, no .call needed here for assignment
      this.exerciseSpecificLogic = this.analyzeRightBicepCurl;
    } else if (exerciseName === 'Kettlebell Snatch') {
      this.currentExercise = exerciseName;
      this.addFeedback('warning', 'Kettlebell Snatch logic not fully implemented yet.');
      // If you had analyzeKettlebellSnatch, it would be:
      // this.exerciseSpecificLogic = this.analyzeKettlebellSnatch;
      this.exerciseSpecificLogic = (pose: posedetection.Pose) => { // Ensure it matches signature
        /* console.log("Kettlebell Snatch placeholder called with pose:", pose); */
      };
    }
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

  // Specific logic for Right Bicep Curl
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
      if (elbowAngle < this.ELBOW_ANGLE_UP_THRESHOLD) {
        this.currentRepCycleState = RepState.UP;
        this.addFeedback('info', `Curl: Up phase detected (Angle: ${elbowAngle.toFixed(0)}°)`);
      }
    } else if (this.currentRepCycleState === RepState.UP) {
      if (elbowAngle > this.ELBOW_ANGLE_DOWN_THRESHOLD) {
        this.incrementRep();
        this.currentRepCycleState = RepState.START;
        this.addFeedback('success', `Curl: Down phase, Rep Complete! (Angle: ${elbowAngle.toFixed(0)}°)`);
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
}