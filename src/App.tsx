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
import { portalPages } from "./portal/pages";
import { HACKER_GUIDE_SLUGS } from "./staff-portal/config";

// The application portal. Lazy so the Supabase client stays out of the bundle the
// holding page loads; see portal/PortalShell.
const PortalShell = lazy(() => import("./portal/PortalShell"));
const SignIn = lazy(portalPages.signIn);
const AuthCallback = lazy(portalPages.authCallback);
const PortalHome = lazy(portalPages.home);
const PortalLayout = lazy(portalPages.layout);
const ApplyLayout = lazy(() => portalPages.apply().then(m => ({ default: m.ApplyLayout })));
const ApplyRedirect = lazy(() => portalPages.apply().then(m => ({ default: m.ApplyRedirect })));
const HackerApplication = lazy(portalPages.hackerApplication);
const StaffApplication = lazy(portalPages.staffApplication);
const PortalStatus = lazy(portalPages.status);
const PortalQuestions = lazy(portalPages.questions);
const PortalSchedule = lazy(portalPages.schedule);
const PortalMentors = lazy(portalPages.mentors);
const PortalWaiver = lazy(portalPages.waiver);
const PortalHandbook = lazy(portalPages.handbook);
const HackerGuide = lazy(portalPages.hackerGuide);
const JudgingPortal = lazy(portalPages.judging);
const OrganizerConsole = lazy(portalPages.organizer);
// Dev only: sign tabs in as dummy applicants. Left out of production builds.
const TestAccounts = import.meta.env.DEV ? lazy(() => import("./dev/TestAccountsPage")) : null;

const PORTALS = ["hacker", "mentor", "judge", "hybrid"] as const;

/** Shown while the portal's first chunks load: the portal's dark page, never a white one. */
const PortalLoading = () => <div style={{ minHeight: "100dvh", background: "#26382f" }} aria-busy="true" />;

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
          <Route element={<PortalBoundary><Suspense fallback={<PortalLoading />}><PortalShell /></Suspense></PortalBoundary>}>
            <Route path={portal.login("hacker")} element={<SignIn as="hacker" />} />
            <Route path={portal.login("judge")} element={<SignIn as="staff" />} />
            <Route path={portal.login("mentor")} element={<SignIn as="staff" />} />
            <Route path={portal.organizerLogin} element={<SignIn as="organizer" />} />
            <Route path={portal.callback} element={<AuthCallback />} />
            {/* One portal for everyone. /portal sends each person to their section, to
                Apply if they haven't applied, or to the organizer console. Each section's
                layout decides which pages are open; see staff-portal/StaffPortalLayout. */}
            <Route path={portal.home} element={<PortalHome />} />
            <Route path={portal.organizer} element={<OrganizerConsole />} />
            {TestAccounts && <Route path="/dev/test-accounts" element={<TestAccounts />} />}
            <Route path={portal.apply} element={<ApplyLayout />}>
              <Route index element={<ApplyRedirect />} />
              <Route path="hacker" element={<HackerApplication />} />
              <Route path="mentor-judge" element={<StaffApplication />} />
            </Route>
            {PORTALS.map(type => (
              <Route key={type} path={`/portal/${type}`} element={<PortalLayout portal={type} />}>
                <Route index element={<PortalStatus />} />
                <Route path="questions" element={<PortalQuestions />} />
                {/* Hackers' handbook is a page per topic; the layout sends their old handbook links to Resources. */}
                <Route path="handbook" element={<PortalHandbook />} />
                {type === "hacker" && HACKER_GUIDE_SLUGS.map(slug => (
                  <Route key={slug} path={slug} element={<HackerGuide page={slug} />} />
                ))}
                <Route path="schedule" element={<PortalSchedule />} />
                <Route path="waiver" element={<PortalWaiver />} />
                {type === "hacker" && <Route path="mentors" element={<PortalMentors />} />}
                {type !== "hacker" && type !== "mentor" && <Route path="judging" element={<JudgingPortal />} />}
              </Route>
            ))}
            {/* Older links. */}
            <Route path="/dashboard/*" element={<Navigate to={portal.home} replace />} />
            <Route path="/apply" element={<Navigate to={portal.applyHacker} replace />} />
            <Route path="/apply/mentor-judge" element={<Navigate to={portal.applyStaff} replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
