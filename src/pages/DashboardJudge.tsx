import { useAuth } from '@/context/AuthContext'

export default function DashboardJudge() {
  const { session } = useAuth()

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome, Judge</h1>
      <p>Signed in as {session?.user?.email}</p>
    </div>
  )
}