import { useParallax } from '@/lib/parallax-context';
import { Layers, Mouse, Eye } from 'lucide-react';

export default function ParallaxControls() {
  const { enabled, setEnabled, trackingMode, setTrackingMode, statusText, cameraActive, faceDetected, fps } = useParallax();

  return (
    <div className="flex items-center gap-1.5" data-testid="parallax-controls">
      <button
        onClick={() => setEnabled(!enabled)}
        data-testid="button-parallax-toggle"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium transition-all border ${
          enabled
            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
            : 'bg-muted/30 text-muted-foreground border-border/30 hover:bg-muted/50'
        }`}
        title={enabled ? 'Disable Parallax Mode' : 'Enable Parallax Mode'}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>Parallax</span>
        {enabled && (
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
        )}
      </button>

      {enabled && (
        <>
          <button
            onClick={() => setTrackingMode(trackingMode === 'mouse' ? 'head' : 'mouse')}
            data-testid="button-tracking-mode"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all border ${
              trackingMode === 'head'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                : 'bg-muted/30 text-muted-foreground border-border/30 hover:bg-muted/50'
            }`}
            title={trackingMode === 'mouse' ? 'Switch to Head Tracking' : 'Switch to Mouse Tracking'}
          >
            {trackingMode === 'mouse' ? (
              <><Mouse className="w-3 h-3" /><span>Mouse</span></>
            ) : (
              <><Eye className="w-3 h-3" /><span>Head Tracking</span></>
            )}
          </button>

          <div
            className="px-2 py-0.5 rounded bg-black/40 text-[9px] font-mono text-cyan-400/80 border border-cyan-500/15 max-w-[220px] truncate"
            data-testid="text-parallax-status"
            title={statusText}
          >
            {statusText} | {fps} FPS
          </div>

          {cameraActive && (
            <span className="flex items-center gap-1 text-[9px] text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              CAM
            </span>
          )}

          {trackingMode === 'head' && faceDetected && (
            <span className="text-[9px] text-green-400" data-testid="text-face-detected">✓ Face</span>
          )}
        </>
      )}
    </div>
  );
}
