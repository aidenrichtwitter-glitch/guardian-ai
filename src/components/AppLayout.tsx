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
                    <div className="ml-auto mr-3">
                      <ParallaxControls />
                    </div>
                  </header>
                  <main className="flex-1 min-h-0 overflow-hidden">
                    {children}
                  </main>
                </div>
              </ParallaxPortal>
            </div>
          </div>
        </ParallaxScene>
      </SidebarProvider>
    </ParallaxProvider>
  );
}
