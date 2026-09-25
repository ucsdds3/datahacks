import { useAuth } from '@/context/AuthContext'
import MinecraftLayout from '@/components/MinecraftLayout'

export default function DashboardJudge() {
  const { session } = useAuth()

  return (
    <MinecraftLayout>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="mc-application-form" style={{ maxWidth: '420px' }}>
          <h2>Welcome, Judge</h2>
          <p className="mc-form-disclaimer">Signed in as {session?.user?.email}</p>
        </div>
      </div>
    </MinecraftLayout>
  )
}