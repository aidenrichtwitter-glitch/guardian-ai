export interface FaceDetectionResult {
  detections: Array<{
    boundingBox: {
      xCenter: number;
      yCenter: number;
      width: number;
      height: number;
    };
  }>;
}

export interface FaceDetectionInstance {
  setOptions(opts: { model: string; minDetectionConfidence: number }): void;
  onResults(cb: (results: FaceDetectionResult) => void): void;
  send(input: { image: HTMLVideoElement }): Promise<void>;
  close(): void;
}

export interface FaceDetectionConstructor {
  new (opts: { locateFile: (file: string) => string }): FaceDetectionInstance;
}

export interface MediaPipeCameraInstance {
  start(): Promise<void>;
  stop(): void;
}

export interface MediaPipeCameraConstructor {
  new (
    video: HTMLVideoElement,
    opts: { onFrame: () => Promise<void>; width: number; height: number }
  ): MediaPipeCameraInstance;
}

export type TrackingMode = 'mouse' | 'head';

export type CubeWall = 'back' | 'left' | 'right' | 'top' | 'bottom';
