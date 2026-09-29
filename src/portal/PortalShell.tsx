import { Outlet } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { NoIndex } from "@/components/NoIndex";

/**
 * Everything that needs a signed-in user lives under this.
 *
 * It is loaded lazily, and that is the point: AuthProvider pulls in the Supabase
 * client, which throws at import when VITE_SUPABASE_URL is missing. Wrapped round
 * the whole app, a build without those values took the public holding page down
 * with it. Here the client is only fetched when someone opens a portal route.
 */
export default function PortalShell() {
  return <AuthProvider><NoIndex /><Outlet /></AuthProvider>;
}
