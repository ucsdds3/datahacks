import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ThemeIndex from "./pages/ThemeIndex";
import Groove from "./themes/groove";
import Pop from "./themes/pop";
import Press from "./themes/press";
import Minecraft from "./themes/minecraft";
import { NoIndex } from "./components/NoIndex";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Minecraft />} />
          {/* Design mockups: placeholder dates and figures, kept out of search. */}
          <Route path="/themes" element={<><NoIndex /><ThemeIndex /></>} />
          <Route path="/pop" element={<><NoIndex /><Pop /></>} />
          <Route path="/press" element={<><NoIndex /><Press /></>} />
          <Route path="/minecraft/*" element={<Minecraft />} />
          <Route path="/groove" element={<><NoIndex /><Groove /></>} />
          <Route path="/legacy" element={<><NoIndex /><Index /></>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
