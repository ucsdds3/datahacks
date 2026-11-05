import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { EVENT_CODE } from "@/portal/event";
import type { ApplicationStatus, PortalRole } from "./config";
import type { StaffApplication } from "./useStaffAccess";
import { callWaiverFunction, fetchWaiverOnFile, type WaiverStatus } from "./waiverFunction";

type StaffPortalState = {
  portal: PortalRole;
  /** Where this portal's pages live, e.g. "/portal/judge". */
  basePath: string;
  fullName: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  /** A signed waiver is on file (public.waivers). */
  waiverSubmitted: boolean;
  /** Who signs the waiver: name, email and application id for the PowerForm link. */
  signer: { name: string; email: string; id: string };
  /**
   * Asks the server to check the envelope with DocuSign and record it. Throws with a
   * message to show if DocuSign has no signature, or it couldn't be recorded.
   */
  submitWaiver: (envelopeId: string | null) => Promise<void>;
  /** Dev `?preview` mode: mock data and a simulated DocuSign. */
  preview: boolean;
  /** Preview only: forget the submitted waiver so the flow can be tried again. */
  resetWaiver: () => void;
};

const StaffPortalContext = createContext<StaffPortalState | null>(null);

/**
 * This browser's copy of "waiver on file", per event and per person: a waiver signed
 * for the test event (or by another account on this browser) never counts for this one.
 * The database is the record; this copy only covers loading and being offline.
 */
export const waiverKey = (userId: string | undefined) =>
  `datahacks.staffPortal.waiverSubmitted.${EVENT_CODE}.${userId ?? "preview"}`;

const waiverQueryKey = (userId: string | undefined) => ["waiver-on-file", EVENT_CODE, userId] as const;

const readWaiver = (key: string) => {
  try { return localStorage.getItem(key) === "true"; } catch { return false; }
};
const writeWaiver = (key: string, onFile: boolean) => {
  try {
    if (onFile) localStorage.setItem(key, "true");
    else localStorage.removeItem(key);
  } catch { /* storage blocked */ }
};

export function StaffPortalProvider({ application, preview, children }: { application: StaffApplication; preview: boolean; children: ReactNode }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;
  const key = waiverKey(userId);
  const [cached, setCached] = useState(() => readWaiver(key));
  useEffect(() => setCached(readWaiver(key)), [key]);

  const onFile = useQuery({
    queryKey: waiverQueryKey(userId),
    queryFn: () => fetchWaiverOnFile(userId!),
    enabled: !preview && !!userId,
    staleTime: 60_000,
  });
  // Keep this browser's copy in step with the database.
  useEffect(() => {
    if (onFile.isSuccess) { writeWaiver(key, onFile.data); setCached(onFile.data); }
  }, [onFile.isSuccess, onFile.data, key]);

  // The database decides; this browser's copy fills in while it loads or can't be reached.
  const waiverSubmitted = !preview && onFile.isSuccess ? onFile.data : cached;

  const fullName = `${application.firstName} ${application.lastName}`.trim()
    || (session?.user?.user_metadata?.full_name as string | undefined)?.trim()
    || session?.user?.email
    || "there";

  const submitWaiver = useCallback(async (envelopeId: string | null) => {
    if (!preview) {
      if (!envelopeId) throw new Error("Start signing the waiver first.");
      // The server asks DocuSign, and records the waiver if the envelope is completed.
      const { signed, recorded } = await callWaiverFunction<WaiverStatus>({ action: "status", envelopeId });
      if (!signed) throw new Error("No signature detected on the waiver yet.");
      if (!recorded) throw new Error("DocuSign has your signature, but we couldn't save it just now. Try Submit again in a minute.");
      queryClient.setQueryData(waiverQueryKey(userId), true);
    }
    writeWaiver(key, true);
    setCached(true);
  }, [key, preview, queryClient, userId]);

  const resetWaiver = useCallback(() => {
    writeWaiver(key, false);
    setCached(false);
  }, [key]);

  const portal = application.type;
  const signer = {
    name: `${application.firstName} ${application.lastName}`.trim() || ((session?.user?.user_metadata?.full_name as string | undefined)?.trim() ?? ""),
    email: application.email?.trim() || session?.user?.email || "",
    id: application.id ?? "",
  };
  return (
    <StaffPortalContext.Provider value={{ portal, basePath: `/portal/${portal}`, fullName, status: application.status, submittedAt: application.submittedAt, waiverSubmitted, signer, submitWaiver, preview, resetWaiver }}>
      {children}
    </StaffPortalContext.Provider>
  );
}

export function useStaffPortal() {
  const value = useContext(StaffPortalContext);
  if (!value) throw new Error("useStaffPortal must be used inside StaffPortalProvider");
  return value;
}
