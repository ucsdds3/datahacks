import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import ThemeIndex from "./pages/ThemeIndex";
import Groove from "./themes/groove";
import Pop from "./themes/pop";
import Press from "./themes/press";
import Minecraft from "./themes/minecraft";
import { NoIndex } from "./components/NoIndex";
import Home from "./pages/Home";
import { PortalBoundary } from "./portal/PortalBoundary";
import { portal } from "./portal/paths";
import { portalPages } from "./portal/pages";
import { THEME_BACKGROUND } from "./portal/theme";
import { getPortalTheme } from "./portal/portalTheme";
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
const OAuthConsent = lazy(portalPages.oauthConsent);
// Public: how to apply through an AI assistant. Outside the portal shell, so no Supabase client.
const ApplyWithAi = lazy(() => import("./pages/ApplyWithAi"));
// Public: live application counts. Its own small chunk, no Supabase client (see pages/statsData).
const Stats = lazy(() => import("./pages/Stats"));
// Any unknown address: the End-themed 404. Lazy, so the portal's styles stay out of the home page's bundle.
const NotFound = lazy(() => import("./pages/NotFound"));
// Dev only: sign tabs in as dummy applicants. Left out of production builds.
const TestAccounts = import.meta.env.DEV ? lazy(() => import("./dev/TestAccountsPage")) : null;

const PORTALS = ["hacker", "mentor", "judge", "hybrid"] as const;

/** Shown while the portal's first chunks load: the current theme's dark page, never a white one. */
const PortalLoading = () => <div style={{ minHeight: "100dvh", background: THEME_BACKGROUND[getPortalTheme()] }} aria-busy="true" />;
/** The stats page's dark netherrack while its chunk loads. */
const StatsLoading = () => <div style={{ minHeight: "100dvh", background: "#1a0a0b" }} aria-busy="true" />;

// One retry, not React Query's three: the Supabase client already retries a failed read
// 3 times itself, and 4 rounds of that kept "Loading your portal…" up for ~46 s when
// Supabase couldn't be reached. Now the page says so (with Try again) after ~15 s.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* The homepage is the DataCraft site, a static build the deploy serves at "/" (public/home/).
              Landing here inside the app loads it. The older world under /datacraft stays out of search. */}
          <Route path="/" element={<Home />} />
          <Route path="/datacraft/*" element={<><NoIndex /><Minecraft /></>} />
          {/* Anything still pointing at the old path follows along. */}
          <Route path="/minecraft/*" element={<Navigate to="/datacraft" replace />} />
          {/* Design mockups: placeholder dates and figures, kept out of search. */}
          <Route path="/themes" element={<><NoIndex /><ThemeIndex /></>} />
          <Route path="/pop" element={<><NoIndex /><Pop /></>} />
          <Route path="/press" element={<><NoIndex /><Press /></>} />
          <Route path="/groove" element={<><NoIndex /><Groove /></>} />
          <Route path="/legacy" element={<><NoIndex /><Index /></>} />
          <Route path="/apply-with-ai" element={<Suspense fallback={<PortalLoading />}><ApplyWithAi /></Suspense>} />
          <Route path="/stats" element={<PortalBoundary><Suspense fallback={<StatsLoading />}><Stats /></Suspense></PortalBoundary>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route element={<PortalBoundary><Suspense fallback={<PortalLoading />}><PortalShell /></Suspense></PortalBoundary>}>
            <Route path={portal.login("hacker")} element={<SignIn as="hacker" />} />
            <Route path={portal.login("judge")} element={<SignIn as="staff" />} />
            <Route path={portal.login("mentor")} element={<SignIn as="staff" />} />
            <Route path={portal.organizerLogin} element={<SignIn as="organizer" />} />
            <Route path={portal.callback} element={<AuthCallback />} />
            <Route path={portal.oauthConsent} element={<OAuthConsent />} />
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
          <Route path="*" element={<PortalBoundary><Suspense fallback={<PortalLoading />}><NotFound /></Suspense></PortalBoundary>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
