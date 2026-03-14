import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Evolution from "./pages/Evolution";
import EvolutionCycle from "./pages/PatternAnalysis";
import GrokBridge from "./pages/GrokBridge";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/AppLayout";

const queryClient = new QueryClient();

const isFileProtocol = window.location.protocol === 'file:';
const Router = isFileProtocol ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<GrokBridge />} />
            <Route path="/home" element={<Index />} />
            <Route path="/evolution" element={<Evolution />} />
            <Route path="/evolution-cycle" element={<EvolutionCycle />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
