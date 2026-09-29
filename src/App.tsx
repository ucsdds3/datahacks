import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ThemeIndex from "./pages/ThemeIndex";
import Groove from "./themes/groove";
import Pop from "./themes/pop";
import Press from "./themes/press";
import Minecraft from "./themes/minecraft";
import { NoIndex } from "./components/NoIndex";
import Renovation from "./pages/Renovation";
import { PortalBoundary } from "./portal/PortalBoundary";

// The application portal. Lazy so the Supabase client stays out of the bundle the
// holding page loads; see portal/PortalShell.
const PortalShell = lazy(() => import("./portal/PortalShell"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
const LoginHacker = lazy(() => import("./pages/LoginHacker"));
const LoginJudge = lazy(() => import("./pages/LoginJudge"));
const LoginMentor = lazy(() => import("./pages/LoginMentor"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const DashboardHacker = lazy(() => import("./pages/DashboardHacker"));
const DashboardJudge = lazy(() => import("./pages/DashboardJudge"));
const DashboardMentor = lazy(() => import("./pages/DashboardMentor"));
const ApplicationForm = lazy(() => import("./pages/ApplicationForm"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Production is the holding page. The world being built lives under
              /datacraft and is kept out of search until it ships. */}
          <Route path="/" element={<Renovation />} />
          <Route path="/datacraft/*" element={<><NoIndex /><Minecraft /></>} />
          {/* Anything still pointing at the old path follows along. */}
          <Route path="/minecraft/*" element={<Navigate to="/datacraft" replace />} />
          {/* Design mockups: placeholder dates and figures, kept out of search. */}
          <Route path="/themes" element={<><NoIndex /><ThemeIndex /></>} />
          <Route path="/pop" element={<><NoIndex /><Pop /></>} />
          <Route path="/press" element={<><NoIndex /><Press /></>} />
          <Route path="/groove" element={<><NoIndex /><Groove /></>} />
          <Route path="/legacy" element={<><NoIndex /><Index /></>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route element={<PortalBoundary><Suspense fallback={null}><PortalShell /></Suspense></PortalBoundary>}>
            <Route path="/login/hacker" element={<LoginHacker />} />
            <Route path="/login/judge" element={<LoginJudge />} />
            <Route path="/login/mentor" element={<LoginMentor />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/dashboard/hacker" element={<ProtectedRoute role="hacker"><DashboardHacker /></ProtectedRoute>} />
            <Route path="/dashboard/judge" element={<ProtectedRoute role="judge"><DashboardJudge /></ProtectedRoute>} />
            <Route path="/dashboard/mentor" element={<ProtectedRoute role="mentor"><DashboardMentor /></ProtectedRoute>} />
            <Route path="/apply" element={<ProtectedRoute role="hacker"><ApplicationForm /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
