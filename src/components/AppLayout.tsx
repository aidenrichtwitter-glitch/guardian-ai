import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ParallaxProvider, ParallaxPortal } from "@/lib/parallax-context";
import ParallaxScene from "@/components/ParallaxScene";
import ParallaxControls from "@/components/ParallaxControls";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ParallaxProvider>
      <SidebarProvider>
        <ParallaxScene>
          <div className="h-screen flex w-full overflow-hidden">
            <ParallaxPortal wall="left">
              <AppSidebar />
            </ParallaxPortal>
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <ParallaxPortal wall="back">
                <div className="flex flex-col h-full min-h-0 overflow-hidden">
                  <header className="h-10 flex items-center border-b border-border bg-background/80 backdrop-blur-sm shrink-0 z-20">
                    <SidebarTrigger className="ml-2" />
                  </header>
                  <main className="flex-1 min-h-0 overflow-hidden">
                    {children}
                  </main>
                </div>
              </ParallaxPortal>
            </div>
          </div>
        </ParallaxScene>
        <div
          data-testid="parallax-controls-overlay"
          style={{
            position: 'fixed',
            top: 12,
            right: 16,
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: 8,
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(160,32,240,0.3)',
            pointerEvents: 'auto',
          }}
        >
          <ParallaxControls />
        </div>
      </SidebarProvider>
    </ParallaxProvider>
  );
}
