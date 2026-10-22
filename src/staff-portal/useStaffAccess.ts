import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { MOCK_APPLICATION, type ApplicationStatus, type PortalRole } from "./config";

export type StaffApplication = { firstName: string; lastName: string; type: PortalRole; status: ApplicationStatus };

export type StaffAccess =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "error"; message: string }
  | { state: "no-application"; email: string }
  | { state: "ready"; application: StaffApplication; preview: boolean };

const PORTALS: PortalRole[] = ["mentor", "judge", "hybrid"];
const STATUSES: ApplicationStatus[] = ["pending", "accepted", "rejected"];

// Anything that isn't a decision yet ("submitted", etc.) shows as pending.
const toStatus = (value: string | null): ApplicationStatus =>
  value === "accepted" || value === "rejected" ? value : "pending";

type ApplicationRow = { first_name: string | null; last_name: string | null; applicant_type: string; status: string | null };

async function fetchApplication(userId: string): Promise<StaffApplication | null> {
  // Row-level security only returns the signed-in person's own applications.
  const { data, error } = await supabase
    .from("applications")
    .select("first_name, last_name, applicant_type, status")
    .eq("user_id", userId)
    .in("applicant_type", PORTALS)
    .order("submitted_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data as ApplicationRow[] | null)?.[0];
  if (!row || !PORTALS.includes(row.applicant_type as PortalRole)) return null;
  return {
    firstName: row.first_name?.trim() ?? "",
    lastName: row.last_name?.trim() ?? "",
    type: row.applicant_type as PortalRole,
    status: toStatus(row.status),
  };
}

/**
 * The signed-in person's mentor/judge/hybrid application, which decides which portal
 * they see. In `npm run dev`, adding `?preview` skips sign-in and shows mock data for
 * the portal in the URL (`&status=pending|accepted|rejected` picks the status).
 */
export function useStaffAccess(portal?: PortalRole): StaffAccess {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  const preview = import.meta.env.DEV && params.has("preview");

  const query = useQuery({
    queryKey: ["staff-application", session?.user.id],
    queryFn: () => fetchApplication(session!.user.id),
    enabled: !preview && !!session,
    staleTime: 60_000,
  });

  if (preview) {
    const status = params.get("status") as ApplicationStatus | null;
    return {
      state: "ready",
      preview: true,
      application: {
        firstName: MOCK_APPLICATION.firstName,
        lastName: MOCK_APPLICATION.lastName,
        type: portal ?? "mentor",
        status: status && STATUSES.includes(status) ? status : MOCK_APPLICATION.status,
      },
    };
  }
  if (loading) return { state: "loading" };
  if (!session) return { state: "signed-out" };
  if (query.isPending) return { state: "loading" };
  if (query.isError) return { state: "error", message: query.error.message };
  if (!query.data) return { state: "no-application", email: session.user.email ?? "" };
  return { state: "ready", application: query.data, preview: false };
}
