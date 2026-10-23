import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { EVENT_CODE } from "@/portal/event";
import type { ApplicationStatus, PortalRole } from "./config";
import type { StaffApplication } from "./useStaffAccess";

type StaffPortalState = {
  portal: PortalRole;
  /** Where this portal's pages live, e.g. "/portal/judge". */
  basePath: string;
  fullName: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  waiverSubmitted: boolean;
  submitWaiver: () => Promise<void>;
  /** Dev `?preview` mode: mock data and a simulated DocuSign. */
  preview: boolean;
  /** Preview only: forget the submitted waiver so the flow can be tried again. */
  resetWaiver: () => void;
};

const StaffPortalContext = createContext<StaffPortalState | null>(null);

/**
 * Per event and per person: a waiver signed for the test event (or by another
 * account on this browser) never counts for this one.
 */
export const waiverKey = (userId: string | undefined) =>
  `datahacks.staffPortal.waiverSubmitted.${EVENT_CODE}.${userId ?? "preview"}`;

const readWaiver = (key: string) => {
  try { return localStorage.getItem(key) === "true"; } catch { return false; }
};

export function StaffPortalProvider({ application, preview, children }: { application: StaffApplication; preview: boolean; children: ReactNode }) {
  const { session } = useAuth();
  const key = waiverKey(session?.user?.id);
  const [waiverSubmitted, setWaiverSubmitted] = useState(() => readWaiver(key));
  useEffect(() => setWaiverSubmitted(readWaiver(key)), [key]);

  const fullName = `${application.firstName} ${application.lastName}`.trim()
    || (session?.user?.user_metadata?.full_name as string | undefined)?.trim()
    || session?.user?.email
    || "there";

  const submitWaiver = useCallback(async () => {
    // TODO: record the submission in Supabase instead of this browser.
    try { localStorage.setItem(key, "true"); } catch { /* storage blocked */ }
    setWaiverSubmitted(true);
  }, [key]);

  const resetWaiver = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* storage blocked */ }
    setWaiverSubmitted(false);
  }, [key]);

  const portal = application.type;
  return (
    <StaffPortalContext.Provider value={{ portal, basePath: `/portal/${portal}`, fullName, status: application.status, submittedAt: application.submittedAt, waiverSubmitted, submitWaiver, preview, resetWaiver }}>
      {children}
    </StaffPortalContext.Provider>
  );
}

export function useStaffPortal() {
  const value = useContext(StaffPortalContext);
  if (!value) throw new Error("useStaffPortal must be used inside StaffPortalProvider");
  return value;
}
