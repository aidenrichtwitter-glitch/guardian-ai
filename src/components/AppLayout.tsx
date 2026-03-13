import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ParallaxProvider, ParallaxPortal, useParallax } from "@/lib/parallax-context";
import ParallaxScene from "@/components/ParallaxScene";
import ParallaxControls from "@/components/ParallaxControls";
import { WallNavPanel } from "@/components/WallNavPanel";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { enabled } = useParallax();

  return (
    <SidebarProvider>
      <ParallaxScene>
        <div className="h-screen flex w-full overflow-hidden">
          {enabled ? (
            <ParallaxPortal wall="left">
              <WallNavPanel />
            </ParallaxPortal>
          ) : (
            <AppSidebar />
          )}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <ParallaxPortal wall="top">
              <header className="h-10 flex items-center border-b border-border bg-background/80 backdrop-blur-sm shrink-0 z-20">
                <SidebarTrigger className="ml-2" />
                <div className="ml-auto mr-3">
                  <ParallaxControls />
                </div>
              </header>
            </ParallaxPortal>
            <ParallaxPortal wall="back">
              <main className="flex-1 min-h-0 overflow-hidden">
                {children}
              </main>
            </ParallaxPortal>
          </div>
        </div>
      </ParallaxScene>
    </SidebarProvider>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ParallaxProvider>
      <LayoutInner>{children}</LayoutInner>
    </ParallaxProvider>
  );
}
