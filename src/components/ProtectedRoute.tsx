import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ReactNode } from 'react'
import { portal, type LoginRole, type Role } from '@/portal/paths'

/**
 * Signed-out visitors go to the `login` page. With a `role`, being signed in
 * is not enough: it has to match the role on the person's profile, and someone
 * in the wrong area is sent to their own.
 *
 * This keeps people out of the wrong screens. It does not protect data — the
 * row-level security policies in supabase/migrations do that.
 */
export default function ProtectedRoute({
  children,
  login,
  role,
}: {
  children: ReactNode
  login: LoginRole
  role?: Role
}) {
  const { session, role: actual, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!session) return <Navigate to={portal.login(login)} replace />
  if (!role) return <>{children}</>
  // Signed in with no profile yet: the callback creates it.
  if (!actual) return <Navigate to={portal.login(login)} replace />
  if (actual !== role) return <Navigate to={portal.home(actual)} replace />

  return <>{children}</>
}
