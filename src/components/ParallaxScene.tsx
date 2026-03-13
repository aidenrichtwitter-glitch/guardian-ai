import { useRef, useEffect, useCallback, useState } from 'react';
import { useParallax } from '@/lib/parallax-context';
import type { CubeWall } from '@/lib/parallax-types';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

const CUBE_SIZE = 900;
const HALF = CUBE_SIZE / 2;

interface WallSpec {
  wall: CubeWall;
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
  bgColor: string;
  borderColor: string;
}

const WALL_SPECS: WallSpec[] = [
  {
    wall: 'back',
    position: [0, 0, -HALF],
    rotation: [0, 0, 0],
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    bgColor: 'rgba(160, 32, 240, 0.06)',
    borderColor: 'rgba(160, 32, 240, 0.15)',
  },
  {
    wall: 'left',
    position: [-HALF, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    bgColor: 'rgba(0, 255, 255, 0.05)',
    borderColor: 'rgba(0, 255, 255, 0.12)',
  },
  {
    wall: 'right',
    position: [HALF, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    bgColor: 'rgba(255, 191, 0, 0.05)',
    borderColor: 'rgba(255, 191, 0, 0.12)',
  },
  {
    wall: 'top',
    position: [0, HALF, 0],
    rotation: [Math.PI / 2, 0, 0],
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    bgColor: 'rgba(0, 128, 128, 0.04)',
    borderColor: 'rgba(0, 128, 128, 0.1)',
  },
  {
    wall: 'bottom',
    position: [0, -HALF, 0],
    rotation: [-Math.PI / 2, 0, 0],
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    bgColor: 'rgba(148, 0, 211, 0.04)',
    borderColor: 'rgba(148, 0, 211, 0.1)',
  },
];

export default function ParallaxScene({ children }: { children: React.ReactNode }) {
  const {
    enabled, trackingMode,
    lerpRef, targetRef, fpsRef,
    registerWallMount,
    videoRef, faceDotRef,
    statusText, fps, cameraActive,
  } = useParallax();

  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const rendererRef = useRef<CSS3DRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const wallMountRefs = useRef<Record<CubeWall, HTMLDivElement | null>>({
    back: null, left: null, right: null, top: null, bottom: null,
  });
  const registerWallMountRef = useRef(registerWallMount);
  registerWallMountRef.current = registerWallMount;

  const [sceneReady, setSceneReady] = useState(false);

  const initScene = useCallback(() => {
    if (!sceneContainerRef.current) return;
    const container = sceneContainerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, w / h, 1, 5000);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new CSS3DRenderer();
    renderer.setSize(w, h);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';

    const cameraEl = renderer.domElement.children[0] as HTMLElement | undefined;
    if (cameraEl) cameraEl.style.pointerEvents = 'auto';

    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    WALL_SPECS.forEach(spec => {
      const wallEl = document.createElement('div');
      wallEl.style.width = spec.width + 'px';
      wallEl.style.height = spec.height + 'px';
      wallEl.style.background = spec.bgColor;
      wallEl.style.border = `1px solid ${spec.borderColor}`;
      wallEl.style.boxSizing = 'border-box';
      wallEl.style.overflow = 'hidden';
      wallEl.style.position = 'relative';
      wallEl.style.pointerEvents = 'auto';

      const mountPoint = document.createElement('div');
      mountPoint.style.width = '100%';
      mountPoint.style.height = '100%';
      mountPoint.style.position = 'absolute';
      mountPoint.style.top = '0';
      mountPoint.style.left = '0';
      mountPoint.style.overflow = 'auto';
      mountPoint.style.pointerEvents = 'auto';

      if (spec.wall === 'bottom') {
        mountPoint.style.display = 'flex';
        mountPoint.style.flexDirection = 'column';
        mountPoint.style.justifyContent = 'flex-start';
      } else if (spec.wall === 'top') {
        mountPoint.style.display = 'flex';
        mountPoint.style.flexDirection = 'column';
        mountPoint.style.justifyContent = 'flex-end';
      } else if (spec.wall === 'right') {
        mountPoint.style.display = 'flex';
        mountPoint.style.flexDirection = 'row';
        mountPoint.style.justifyContent = 'flex-start';
      } else if (spec.wall === 'left') {
        mountPoint.style.display = 'flex';
        mountPoint.style.flexDirection = 'row';
        mountPoint.style.justifyContent = 'flex-end';
      }

      wallEl.appendChild(mountPoint);

      wallMountRefs.current[spec.wall] = mountPoint;
      registerWallMountRef.current(spec.wall, mountPoint);

      const obj = new CSS3DObject(wallEl);
      obj.position.set(...spec.position);
      obj.rotation.set(...spec.rotation);
      obj.element.style.pointerEvents = 'auto';
      scene.add(obj);
    });

    setSceneReady(true);

    return () => {
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      WALL_SPECS.forEach(spec => {
        wallMountRefs.current[spec.wall] = null;
        registerWallMountRef.current(spec.wall, null);
      });
      setSceneReady(false);
    };
  }, []);

  const destroyScene = useCallback(() => {
    if (rendererRef.current?.domElement?.parentNode) {
      rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
    }
    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    const walls: CubeWall[] = ['back', 'left', 'right', 'top', 'bottom'];
    walls.forEach(w => {
      wallMountRefs.current[w] = null;
      registerWallMountRef.current(w, null);
    });
    setSceneReady(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      cancelAnimationFrame(animFrameRef.current);
      destroyScene();
      if (contentRef.current) contentRef.current.style.transform = '';
      return;
    }

    const cleanup = initScene();

    const reEnablePointerEvents = () => {
      if (!rendererRef.current) return;
      const cameraEl = rendererRef.current.domElement.children[0] as HTMLElement | undefined;
      if (cameraEl && cameraEl.style.pointerEvents !== 'auto') {
        cameraEl.style.pointerEvents = 'auto';
      }
    };

    const animate = () => {
      const lerp = lerpRef.current;
      const target = targetRef.current;
      lerp.headX = lerp.headX * 0.85 + target.x * 0.15;
      lerp.headY = lerp.headY * 0.85 + target.y * 0.15;

      const fpsData = fpsRef.current;
      fpsData.frames++;
      const now = performance.now();
      if (now - fpsData.lastTime >= 1000) {
        fpsData.fps = Math.round(fpsData.frames * 1000 / (now - fpsData.lastTime));
        fpsData.frames = 0;
        fpsData.lastTime = now;
      }

      if (cameraRef.current && rendererRef.current && sceneRef.current) {
        const cam = cameraRef.current;
        const invertX = trackingMode === 'head' ? -1 : 1;
        cam.position.x = invertX * lerp.headX * 80;
        cam.position.y = -lerp.headY * 60;
        cam.lookAt(
          invertX * lerp.headX * CUBE_SIZE * 0.4,
          -lerp.headY * CUBE_SIZE * 0.3,
          -HALF
        );
        rendererRef.current.render(sceneRef.current, cam);
        reEnablePointerEvents();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (cleanup) cleanup();
    };
  }, [enabled, trackingMode, lerpRef, targetRef, fpsRef, initScene, destroyScene]);

  useEffect(() => {
    if (!enabled || !rendererRef.current || !cameraRef.current) return;
    const handleResize = () => {
      if (!sceneContainerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = sceneContainerRef.current.clientWidth;
      const h = sceneContainerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [enabled, sceneReady]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={sceneContainerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#0a0014',
      }}
    >
      <div
        ref={contentRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: 1,
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        {children}
      </div>

      <div
        data-testid="parallax-status-overlay"
        style={{
          position: 'fixed',
          top: 50,
          left: 20,
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.6)',
          color: '#0ff',
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.6,
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(0,255,255,0.2)',
          fontFamily: 'monospace',
          zIndex: 10000,
          pointerEvents: 'none',
          whiteSpace: 'pre',
        }}
      >
        {`Mode: ${trackingMode === 'head' ? 'Head Tracking' : 'Mouse'}\nx: ${lerpRef.current.headX.toFixed(2)}  y: ${lerpRef.current.headY.toFixed(2)}\nFPS: ${fps}`}
      </div>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        data-testid="parallax-cam-preview"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 160,
          height: 120,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.2)',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          display: trackingMode === 'head' && cameraActive ? 'block' : 'none',
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(160,32,240,0.3)',
        }}
      />

      <div
        ref={faceDotRef}
        data-testid="parallax-face-dot"
        style={{
          position: 'fixed',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#0ff',
          pointerEvents: 'none',
          zIndex: 10000,
          transform: 'translate(-50%, -50%)',
          display: 'none',
          boxShadow: '0 0 8px #0ff',
        }}
      />
    </div>
  );
}
