import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div style={{ height: '100vh', display: 'flex', width: '100%', overflow: 'hidden' }}>
        <AppSidebar />
        <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <header className="h-10 flex items-center border-b border-border bg-background/80 backdrop-blur-sm shrink-0 z-20">
            <SidebarTrigger className="ml-2" />
          </header>
          <main style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'scroll', position: 'relative' }}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
