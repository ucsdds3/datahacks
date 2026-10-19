import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import type { ApplicationStatus, PortalRole } from "./config";
import type { StaffApplication } from "./useStaffAccess";

type StaffPortalState = {
  portal: PortalRole;
  /** Where this portal's pages live, e.g. "/portal/judge". */
  basePath: string;
  fullName: string;
  status: ApplicationStatus;
  waiverSubmitted: boolean;
  submitWaiver: () => Promise<void>;
};

const StaffPortalContext = createContext<StaffPortalState | null>(null);

const WAIVER_KEY = "datahacks.staffPortal.waiverSubmitted";

const readWaiver = () => {
  try { return localStorage.getItem(WAIVER_KEY) === "true"; } catch { return false; }
};

export function StaffPortalProvider({ application, children }: { application: StaffApplication; children: ReactNode }) {
  const { session } = useAuth();
  const [waiverSubmitted, setWaiverSubmitted] = useState(readWaiver);

  const fullName = `${application.firstName} ${application.lastName}`.trim()
    || (session?.user?.user_metadata?.full_name as string | undefined)?.trim()
    || session?.user?.email
    || "there";

  const submitWaiver = useCallback(async () => {
    // TODO: record the submission in Supabase instead of this browser.
    try { localStorage.setItem(WAIVER_KEY, "true"); } catch { /* storage blocked */ }
    setWaiverSubmitted(true);
  }, []);

  const portal = application.type;
  return (
    <StaffPortalContext.Provider value={{ portal, basePath: `/portal/${portal}`, fullName, status: application.status, waiverSubmitted, submitWaiver }}>
      {children}
    </StaffPortalContext.Provider>
  );
}

export function useStaffPortal() {
  const value = useContext(StaffPortalContext);
  if (!value) throw new Error("useStaffPortal must be used inside StaffPortalProvider");
  return value;
}
