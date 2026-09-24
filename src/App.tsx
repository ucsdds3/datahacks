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
import { AuthProvider } from "@/context/AuthContext";
import LoginHacker from "./pages/LoginHacker";
import LoginJudge from "./pages/LoginJudge";
import LoginMentor from "./pages/LoginMentor";
import AuthCallback from "./pages/AuthCallback";
import DashboardHacker from "./pages/DashboardHacker";
import DashboardJudge from "./pages/DashboardJudge";
import DashboardMentor from "./pages/DashboardMentor";
import ProtectedRoute from "./components/ProtectedRoute";
import ApplicationForm from "./pages/ApplicationForm";

const queryClient = new QueryClient();

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Minecraft />} />
            <Route path="/themes" element={<ThemeIndex />} />
            <Route path="/pop" element={<Pop />} />
            <Route path="/press" element={<Press />} />
            <Route path="/minecraft/*" element={<Minecraft />} />
            <Route path="/groove" element={<Groove />} />
            <Route path="/legacy" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/login/hacker" element={<LoginHacker />} />
            <Route path="/login/judge" element={<LoginJudge />} />
            <Route path="/login/mentor" element={<LoginMentor />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/dashboard/hacker" element={<ProtectedRoute role="hacker"><DashboardHacker /></ProtectedRoute>} />
            <Route path="/dashboard/judge" element={<ProtectedRoute role="judge"><DashboardJudge /></ProtectedRoute>} />
            <Route path="/dashboard/mentor" element={<ProtectedRoute role="mentor"><DashboardMentor /></ProtectedRoute>} />
            <Route path="/apply" element={<ProtectedRoute role="hacker"><ApplicationForm /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;