import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import Companies from "./pages/Companies";
import CompanyDetail from "./pages/CompanyDetail";
import Sectors from "./pages/Sectors";
import SectorDetail from "./pages/SectorDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="theme" disableTransitionOnChange>
      <TooltipProvider>
        <BrowserRouter>
          <SidebarProvider>
            <div className="min-h-screen flex w-full">
              <AppSidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/companies" element={<Companies />} />
                  <Route path="/company/:id" element={<CompanyDetail />} />
                  <Route path="/sectors" element={<Sectors />} />
                  <Route path="/sectors/:sector" element={<SectorDetail />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </div>
            <Toaster />
            <Sonner />
          </SidebarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
