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
import { portal } from "./portal/paths";

// The application portal. Lazy so the Supabase client stays out of the bundle the
// holding page loads; see portal/PortalShell.
const PortalShell = lazy(() => import("./portal/PortalShell"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
const LoginHacker = lazy(() => import("./pages/LoginHacker"));
const LoginJudge = lazy(() => import("./pages/LoginJudge"));
const LoginMentor = lazy(() => import("./pages/LoginMentor"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const DashboardHacker = lazy(() => import("./pages/DashboardHacker"));
const ApplicationForm = lazy(() => import("./pages/ApplicationForm"));
const MentorJudgeApplication = lazy(() => import("./pages/MentorJudgeApplication"));
const PortalHome = lazy(() => import("./staff-portal/StaffGate"));
const StaffPortalLayout = lazy(() => import("./staff-portal/StaffPortalLayout"));
const StaffDashboard = lazy(() => import("./staff-portal/Dashboard"));
const StaffWaiver = lazy(() => import("./staff-portal/Waiver"));
const StaffHandbook = lazy(() => import("./staff-portal/Handbook"));
const JudgingPortal = lazy(() => import("./staff-portal/JudgingPortal"));

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
            <Route path={portal.login("hacker")} element={<LoginHacker />} />
            <Route path={portal.login("judge")} element={<LoginJudge />} />
            <Route path={portal.login("mentor")} element={<LoginMentor />} />
            <Route path={portal.callback} element={<AuthCallback />} />
            <Route path={portal.hackerDashboard} element={<ProtectedRoute login="hacker" role="hacker"><DashboardHacker /></ProtectedRoute>} />
            {/* Mentors, judges and hybrids all land on /portal, which picks their portal. */}
            <Route path="/dashboard/judge" element={<Navigate to={portal.staffPortal} replace />} />
            <Route path="/dashboard/mentor" element={<Navigate to={portal.staffPortal} replace />} />
            {/* No role required: applicants aren't mentors or judges until accepted. */}
            <Route path={portal.staffApplication} element={<ProtectedRoute login="mentor"><MentorJudgeApplication /></ProtectedRoute>} />
            <Route path={portal.application} element={<ProtectedRoute login="hacker" role="hacker"><ApplicationForm /></ProtectedRoute>} />
            {/* Mentor/judge/hybrid portal. Each layout checks sign-in and sends people to
                the portal matching their application; see staff-portal/useStaffAccess. */}
            <Route path="/portal" element={<PortalHome />} />
            <Route path="/portal/mentor" element={<StaffPortalLayout portal="mentor" />}>
              <Route index element={<StaffDashboard />} />
              <Route path="waiver" element={<StaffWaiver />} />
              <Route path="handbook" element={<StaffHandbook />} />
            </Route>
            <Route path="/portal/judge" element={<StaffPortalLayout portal="judge" />}>
              <Route index element={<StaffDashboard />} />
              <Route path="waiver" element={<StaffWaiver />} />
              <Route path="handbook" element={<StaffHandbook />} />
              <Route path="judging" element={<JudgingPortal />} />
            </Route>
            <Route path="/portal/hybrid" element={<StaffPortalLayout portal="hybrid" />}>
              <Route index element={<StaffDashboard />} />
              <Route path="waiver" element={<StaffWaiver />} />
              <Route path="handbook" element={<StaffHandbook />} />
              <Route path="judging" element={<JudgingPortal />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
