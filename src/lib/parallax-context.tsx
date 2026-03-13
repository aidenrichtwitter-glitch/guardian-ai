import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type {
  TrackingMode,
  CubeWall,
  FaceDetectionInstance,
  FaceDetectionConstructor,
  MediaPipeCameraInstance,
  MediaPipeCameraConstructor,
} from '@/lib/parallax-types';

interface ParallaxState {
  enabled: boolean;
  trackingMode: TrackingMode;
  faceDetected: boolean;
  cameraActive: boolean;
  statusText: string;
  fps: number;
}

interface ParallaxContextValue extends ParallaxState {
  setEnabled: (v: boolean) => void;
  setTrackingMode: (m: TrackingMode) => void;
  lerpRef: React.MutableRefObject<{ headX: number; headY: number }>;
  targetRef: React.MutableRefObject<{ x: number; y: number }>;
  fpsRef: React.MutableRefObject<{ frames: number; lastTime: number; fps: number }>;
  wallMountPoints: Record<CubeWall, HTMLDivElement | null>;
  registerWallMount: (wall: CubeWall, el: HTMLDivElement | null) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  faceDotRef: React.RefObject<HTMLDivElement>;
}

const ParallaxContext = createContext<ParallaxContextValue | null>(null);

const LS_KEY_ENABLED = 'parallax-enabled';
const LS_KEY_MODE = 'parallax-tracking-mode';

function loadMediaPipeScripts(): Promise<void> {
  const URLS = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js',
  ];
  return new Promise((resolve, reject) => {
    let loaded = 0;
    const onLoad = () => { loaded++; if (loaded === URLS.length) resolve(); };
    for (const url of URLS) {
      if (document.querySelector(`script[src="${url}"]`)) { onLoad(); continue; }
      const s = document.createElement('script');
      s.src = url;
      s.crossOrigin = 'anonymous';
      s.onload = onLoad;
      s.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(s);
    }
  });
}

export function ParallaxProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledRaw] = useState(() => {
    try { return localStorage.getItem(LS_KEY_ENABLED) === 'true'; } catch { return false; }
  });
  const [trackingMode, setTrackingModeRaw] = useState<TrackingMode>(() => {
    try { return (localStorage.getItem(LS_KEY_MODE) as TrackingMode) || 'mouse'; } catch { return 'mouse'; }
  });
  const [faceDetected, setFaceDetected] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [statusText, setStatusText] = useState('Mode: Mouse');
  const [fps, setFps] = useState(0);
  const [wallMountPoints, setWallMountPoints] = useState<Record<CubeWall, HTMLDivElement | null>>({
    back: null, left: null, right: null, top: null, bottom: null,
  });

  const lerpRef = useRef({ headX: 0, headY: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceDotRef = useRef<HTMLDivElement>(null);
  const mpCameraRef = useRef<MediaPipeCameraInstance | null>(null);
  const faceDetectionRef = useRef<FaceDetectionInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptsLoadedRef = useRef(false);

  const stopHeadTracking = useCallback(() => {
    if (mpCameraRef.current) { try { mpCameraRef.current.stop(); } catch (e: unknown) { console.warn('Camera stop error:', e); } mpCameraRef.current = null; }
    if (faceDetectionRef.current) { try { faceDetectionRef.current.close(); } catch (e: unknown) { console.warn('FaceDetection close error:', e); } faceDetectionRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setFaceDetected(false);
  }, []);

  const startHeadTracking = useCallback(async () => {
    try {
      setStatusText('Loading face detection...');
      if (!scriptsLoadedRef.current) {
        await loadMediaPipeScripts();
        scriptsLoadedRef.current = true;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);

      const FD = (window as unknown as { FaceDetection: FaceDetectionConstructor }).FaceDetection;
      const fd = new FD({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`
      });
      faceDetectionRef.current = fd;
      fd.setOptions({ model: 'short', minDetectionConfidence: 0.5 });

      fd.onResults((results) => {
        if (results.detections && results.detections.length > 0) {
          const box = results.detections[0].boundingBox;
          const cx = 1 - box.xCenter;
          const cy = box.yCenter;
          const tx = cx * 2 - 1;
          const ty = cy * 2 - 1;
          targetRef.current = { x: tx, y: ty };
          setFaceDetected(true);
          if (faceDotRef.current) {
            faceDotRef.current.style.left = (cx * window.innerWidth) + 'px';
            faceDotRef.current.style.top = (cy * window.innerHeight) + 'px';
            faceDotRef.current.style.display = 'block';
          }
          setStatusText(`Head ✓ | x:${tx.toFixed(2)} y:${ty.toFixed(2)} | faces:1`);
        } else {
          setFaceDetected(false);
          if (faceDotRef.current) faceDotRef.current.style.display = 'none';
          setStatusText('Head — no face');
        }
      });

      const CameraUtil = (window as unknown as { Camera: MediaPipeCameraConstructor }).Camera;
      const mpCam = new CameraUtil(videoRef.current!, {
        onFrame: async () => {
          if (faceDetectionRef.current && videoRef.current) {
            await faceDetectionRef.current.send({ image: videoRef.current });
          }
        },
        width: 320, height: 240,
      });
      mpCameraRef.current = mpCam;
      await mpCam.start();
      setStatusText('Head ✓ | looking for face…');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatusText(`Cam error: ${msg.slice(0, 40)}`);
      stopHeadTracking();
    }
  }, [stopHeadTracking]);

  useEffect(() => {
    if (!enabled) { stopHeadTracking(); return; }
    if (trackingMode === 'head') { startHeadTracking(); }
    else { stopHeadTracking(); setStatusText('Mode: Mouse'); }
    return () => { stopHeadTracking(); };
  }, [enabled, trackingMode, startHeadTracking, stopHeadTracking]);

  useEffect(() => {
    if (!enabled) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (trackingMode !== 'mouse') return;
      const tx = (e.clientX / window.innerWidth) * 2 - 1;
      const ty = (e.clientY / window.innerHeight) * 2 - 1;
      targetRef.current = { x: tx, y: ty };
      setStatusText(`Mouse | x:${tx.toFixed(2)} y:${ty.toFixed(2)}`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, trackingMode]);

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      setFps(fpsRef.current.fps);
    }, 500);
    return () => clearInterval(interval);
  }, [enabled]);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledRaw(v);
    try { localStorage.setItem(LS_KEY_ENABLED, String(v)); } catch { /* noop */ }
    if (!v) {
      lerpRef.current = { headX: 0, headY: 0 };
      targetRef.current = { x: 0, y: 0 };
    }
  }, []);

  const setTrackingMode = useCallback((m: TrackingMode) => {
    setTrackingModeRaw(m);
    try { localStorage.setItem(LS_KEY_MODE, m); } catch { /* noop */ }
  }, []);

  const registerWallMount = useCallback((wall: CubeWall, el: HTMLDivElement | null) => {
    setWallMountPoints(prev => ({ ...prev, [wall]: el }));
  }, []);

  return (
    <ParallaxContext.Provider value={{
      enabled, trackingMode, faceDetected, cameraActive, statusText, fps,
      setEnabled, setTrackingMode,
      lerpRef, targetRef, fpsRef,
      wallMountPoints, registerWallMount,
      videoRef, faceDotRef,
    }}>
      {children}
    </ParallaxContext.Provider>
  );
}

export function useParallax() {
  const ctx = useContext(ParallaxContext);
  if (!ctx) throw new Error('useParallax must be used within ParallaxProvider');
  return ctx;
}

export function ParallaxPortal({ wall, children }: { wall: CubeWall; children: React.ReactNode }) {
  const { enabled, wallMountPoints } = useParallax();
  const mount = wallMountPoints[wall];
  if (!enabled || !mount) return <>{children}</>;
  return createPortal(children, mount);
}
