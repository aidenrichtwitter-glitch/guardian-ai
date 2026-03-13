import { useState } from "react";
import { Home, Dna, RefreshCw, BrainCircuit, Download, Loader2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";

const items = [
  { title: "AI Bridge", url: "/", icon: BrainCircuit },
  { title: "Evolution", url: "/evolution", icon: Dna },
  { title: "Evolution Cycle", url: "/evolution-cycle", icon: RefreshCw },
  { title: "Home", url: "/home", icon: Home },
];

export function WallNavPanel() {
  const location = useLocation();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/download-source");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lambda-recursive-source.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      data-testid="wall-nav-panel"
      style={{
        width: 240,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'hsl(var(--sidebar-background))',
        borderRight: '1px solid hsl(var(--sidebar-border))',
        color: 'hsl(var(--sidebar-foreground))',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 16px 8px', fontSize: 11, fontWeight: 600, opacity: 0.6, letterSpacing: '0.05em' }}>
        Navigation
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
        {items.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.title}
              to={item.url}
              end
              data-testid={`wall-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              className="hover:bg-muted/50"
              activeClassName="bg-muted text-primary font-medium"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 13,
                textDecoration: 'none',
                color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--sidebar-foreground))',
                background: isActive ? 'hsl(var(--muted))' : 'transparent',
                fontWeight: isActive ? 500 : 400,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <item.icon style={{ width: 16, height: 16 }} />
              <span>{item.title}</span>
            </NavLink>
          );
        })}
      </div>
      <div style={{ borderTop: '1px solid hsl(var(--sidebar-border))', padding: 8 }}>
        <button
          data-testid="wall-nav-download-source"
          onClick={handleDownload}
          disabled={downloading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            width: '100%',
            border: 'none',
            background: 'transparent',
            color: 'hsl(var(--sidebar-foreground))',
            cursor: downloading ? 'wait' : 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--muted) / 0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          {downloading ? (
            <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
          ) : (
            <Download style={{ width: 16, height: 16 }} />
          )}
          <span>{downloading ? "Downloading..." : "Download Source"}</span>
        </button>
      </div>
    </div>
  );
}
