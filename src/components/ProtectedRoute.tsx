import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ReactNode } from 'react'
import { portal, type PortalRole } from '@/portal/paths'

/**
 * Being signed in is not enough: the page's role has to match the role on the
 * person's profile. Someone in the wrong area is sent to their own dashboard.
 *
 * This keeps people out of the wrong screens. It does not protect data — the
 * row-level security policies in supabase/migrations do that.
 */
export default function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode
  role: PortalRole
}) {
  const { session, role: actual, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!session) return <Navigate to={portal.login(role)} replace />
  // Signed in with no profile yet: the callback creates it.
  if (!actual) return <Navigate to={portal.login(role)} replace />
  if (actual !== role) return <Navigate to={portal.dashboard(actual)} replace />

  return <>{children}</>
}
