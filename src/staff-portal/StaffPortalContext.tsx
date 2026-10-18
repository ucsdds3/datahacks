import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { MOCK_APPLICATION, type ApplicationStatus, type StaffRole } from "./config";

type StaffPortalState = {
  firstName: string;
  role: StaffRole;
  status: ApplicationStatus;
  waiverSubmitted: boolean;
  submitWaiver: () => Promise<void>;
};

const StaffPortalContext = createContext<StaffPortalState | null>(null);

const WAIVER_KEY = "datahacks.staffPortal.waiverSubmitted";
const STATUSES: ApplicationStatus[] = ["pending", "accepted", "rejected"];

const readWaiver = () => {
  try { return localStorage.getItem(WAIVER_KEY) === "true"; } catch { return false; }
};

export function StaffPortalProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const [waiverSubmitted, setWaiverSubmitted] = useState(readWaiver);

  // `?status=pending|accepted|rejected` previews each state until the real status
  // comes from Supabase.
  const statusParam = params.get("status") as ApplicationStatus | null;
  const status = statusParam && STATUSES.includes(statusParam) ? statusParam : MOCK_APPLICATION.status;

  const fullName: string | undefined = session?.user?.user_metadata?.full_name;
  const firstName = fullName?.split(" ")[0] || MOCK_APPLICATION.firstName;

  const submitWaiver = useCallback(async () => {
    // TODO: record the submission in Supabase instead of this browser.
    try { localStorage.setItem(WAIVER_KEY, "true"); } catch { /* storage blocked */ }
    setWaiverSubmitted(true);
  }, []);

  return (
    <StaffPortalContext.Provider value={{ firstName, role: MOCK_APPLICATION.role, status, waiverSubmitted, submitWaiver }}>
      {children}
    </StaffPortalContext.Provider>
  );
}

export function useStaffPortal() {
  const value = useContext(StaffPortalContext);
  if (!value) throw new Error("useStaffPortal must be used inside StaffPortalProvider");
  return value;
}
