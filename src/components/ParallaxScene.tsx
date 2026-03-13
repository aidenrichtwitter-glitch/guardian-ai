import { useRef, useEffect, useCallback, useState } from 'react';
import { useParallax } from '@/lib/parallax-context';
import type { CubeWall } from '@/lib/parallax-types';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

const DEPTH = 400;
const SIDE_ANGLE = Math.PI / 3;

function buildWallSpecs(vw: number, vh: number) {
  const halfD = DEPTH / 2;
  const topH = Math.max(120, Math.round(vh * 0.15));
  const bottomH = Math.max(80, Math.round(vh * 0.10));

  const leftW = Math.max(240, Math.round(vw * 0.2));
  const rightW = Math.max(300, Math.round(vw * 0.25));
  const halfW = vw / 2;

  const leftCX = leftW / 2 * Math.cos(SIDE_ANGLE);
  const leftCZ = leftW / 2 * Math.sin(SIDE_ANGLE);
  const rightCX = rightW / 2 * Math.cos(SIDE_ANGLE);
  const rightCZ = rightW / 2 * Math.sin(SIDE_ANGLE);

  return [
    { wall: 'back' as CubeWall,   position: [0, 0, -halfD] as [number,number,number],  rotation: [0, 0, 0] as [number,number,number], width: vw, height: vh },
    { wall: 'left' as CubeWall,   position: [-(halfW + leftCX), 0, -halfD + leftCZ] as [number,number,number],  rotation: [0, SIDE_ANGLE, 0] as [number,number,number], width: leftW, height: vh },
    { wall: 'right' as CubeWall,  position: [halfW + rightCX, 0, -halfD + rightCZ] as [number,number,number],   rotation: [0, -SIDE_ANGLE, 0] as [number,number,number], width: rightW, height: vh },
    { wall: 'top' as CubeWall,    position: [0, vh / 2 - topH / 2, -halfD + 1] as [number,number,number], rotation: [0, 0, 0] as [number,number,number], width: vw, height: topH },
    { wall: 'bottom' as CubeWall, position: [0, -(vh / 2 - bottomH / 2), -halfD + 1] as [number,number,number], rotation: [0, 0, 0] as [number,number,number], width: vw, height: bottomH },
  ];
}

const WALL_COLORS: Record<CubeWall, { bg: string; border: string }> = {
  back:   { bg: 'rgba(160, 32, 240, 0.06)', border: 'rgba(160, 32, 240, 0.15)' },
  left:   { bg: 'rgba(0, 255, 255, 0.05)',  border: 'rgba(0, 255, 255, 0.12)' },
  right:  { bg: 'rgba(255, 191, 0, 0.05)',  border: 'rgba(255, 191, 0, 0.12)' },
  top:    { bg: 'rgba(0, 128, 128, 0.04)',  border: 'rgba(0, 128, 128, 0.1)' },
  bottom: { bg: 'rgba(148, 0, 211, 0.04)',  border: 'rgba(148, 0, 211, 0.1)' },
};


type FocusTarget = CubeWall | 'center';

const FOCUS_OFFSETS: Record<FocusTarget, { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number }> = {
  center: { x: 0, y: 0, z: 0, lookX: 0, lookY: 0, lookZ: -(DEPTH / 2) },
  back:   { x: 0, y: 0, z: -160, lookX: 0, lookY: 0, lookZ: -(DEPTH / 2) },
  left:   { x: -375, y: 0, z: -90, lookX: -600, lookY: 0, lookZ: -(DEPTH / 2) + 50 },
  right:  { x: 375, y: 0, z: -90, lookX: 600, lookY: 0, lookZ: -(DEPTH / 2) + 50 },
  top:    { x: 0, y: 240, z: -80, lookX: 0, lookY: 450, lookZ: -(DEPTH / 2) },
  bottom: { x: 0, y: -240, z: -80, lookX: 0, lookY: -450, lookZ: -(DEPTH / 2) },
};

export default function ParallaxScene({ children }: { children: React.ReactNode }) {
  const {
    enabled, trackingMode,
    lerpRef, targetRef, fpsRef,
    registerWallMount,
    videoRef, faceDotRef,
    cameraActive,
    focusedWall, setFocusedWall,
  } = useParallax();

  const focusedWallRef = useRef(focusedWall);
  focusedWallRef.current = focusedWall;

  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const rendererRef = useRef<CSS3DRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const wallElsRef = useRef<Record<CubeWall, HTMLDivElement | null>>({
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
    camera.position.set(0, 0, DEPTH * 0.65);
    cameraRef.current = camera;

    const renderer = new CSS3DRenderer();
    renderer.setSize(w, h);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const viewEl = renderer.domElement.firstElementChild as HTMLElement;
    if (viewEl) {
      viewEl.style.pointerEvents = 'auto';
      const camEl = viewEl.firstElementChild as HTMLElement;
      if (camEl) {
        camEl.style.pointerEvents = 'auto';
      }
    }

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      [data-wall] {
        display: flex !important;
        align-items: stretch !important;
      }
      [data-wall="back"], [data-wall="top"], [data-wall="bottom"] {
        flex-direction: column !important;
      }
      [data-wall="left"] {
        flex-direction: row !important;
        justify-content: flex-end !important;
      }
      [data-wall="right"] {
        flex-direction: row !important;
        justify-content: flex-start !important;
      }
    `;
    document.head.appendChild(styleEl);

    const wallSpecs = buildWallSpecs(w, h);
    wallSpecs.forEach(spec => {
      const colors = WALL_COLORS[spec.wall];
      const wallEl = document.createElement('div');
      wallEl.style.width = spec.width + 'px';
      wallEl.style.height = spec.height + 'px';
      wallEl.style.background = colors.bg;
      wallEl.style.border = `1px solid ${colors.border}`;
      wallEl.style.boxSizing = 'border-box';
      wallEl.style.overflow = 'auto';
      wallEl.style.contain = 'layout style paint';
      wallEl.style.position = 'relative';
      wallEl.setAttribute('data-wall', spec.wall);

      const wall = spec.wall as CubeWall;
      wallEl.addEventListener('click', () => {
        if (wall === 'back') {
          setFocusedWall('center');
        } else {
          setFocusedWall(focusedWallRef.current === wall ? 'center' : wall);
        }
      });

      const obj = new CSS3DObject(wallEl);
      obj.position.set(...spec.position);
      obj.rotation.set(...spec.rotation);
      scene.add(obj);

      wallElsRef.current[spec.wall] = wallEl;
      registerWallMountRef.current(spec.wall, wallEl);
    });

    setSceneReady(true);

    return () => {
      if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      const walls: CubeWall[] = ['back', 'left', 'right', 'top', 'bottom'];
      walls.forEach(w => {
        registerWallMountRef.current(w, null);
        wallElsRef.current[w] = null;
      });
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      setSceneReady(false);
    };
  }, []);

  const destroyScene = useCallback(() => {
    if (rendererRef.current?.domElement?.parentNode) {
      rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
    }
    const walls: CubeWall[] = ['back', 'left', 'right', 'top', 'bottom'];
    walls.forEach(w => {
      registerWallMountRef.current(w, null);
      wallElsRef.current[w] = null;
    });
    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    setSceneReady(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      cancelAnimationFrame(animFrameRef.current);
      destroyScene();
      return;
    }

    const cleanup = initScene();

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

      const invertX = trackingMode === 'head' ? -1 : 1;
      const invertY = trackingMode === 'head' ? 1 : -1;

      if (cameraRef.current && rendererRef.current && sceneRef.current) {
        const cam = cameraRef.current;
        const fo = FOCUS_OFFSETS[focusedWallRef.current];
        const baseZ = DEPTH * 0.65;
        const targetPosX = invertX * lerp.headX * 120 + fo.x;
        const targetPosY = invertY * lerp.headY * 90 + fo.y;
        const targetPosZ = baseZ + fo.z;
        cam.position.x += (targetPosX - cam.position.x) * 0.08;
        cam.position.y += (targetPosY - cam.position.y) * 0.08;
        cam.position.z += (targetPosZ - cam.position.z) * 0.08;
        cam.lookAt(
          invertX * lerp.headX * 300 + fo.lookX,
          invertY * lerp.headY * 225 + fo.lookY,
          fo.lookZ
        );
        rendererRef.current.render(sceneRef.current, cam);
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
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: -1,
          pointerEvents: 'none',
          opacity: 0,
          overflow: 'hidden',
        }}
      >
        {children}
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
