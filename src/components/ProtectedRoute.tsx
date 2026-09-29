import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ReactNode } from 'react'

export default function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode
  role: 'hacker' | 'judge' | 'mentor'
}) {
  const { session, loading } = useAuth()

  if (loading) return <div>Loading...</div>

  if (!session) {
    return <Navigate to={`/login/${role}`} replace />
  }

  return <>{children}</>
}