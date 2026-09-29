import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { Link } from 'react-router-dom'
import MinecraftLayout from '@/components/MinecraftLayout'

type Application = {
  status: string
  submitted_at: string | null
}

export default function DashboardHacker() {
  const { session } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchApplication = async () => {
      if (!session) return
      const { data } = await supabase
        .from('applications')
        .select('status, submitted_at')
        .eq('user_id', session.user.id)
        .maybeSingle()
      setApplication(data)
      setLoading(false)
    }
    fetchApplication()
  }, [session])

  if (loading) return <MinecraftLayout><div style={{ padding: '4rem', textAlign: 'center' }}>Loading...</div></MinecraftLayout>

  return (
    <MinecraftLayout>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="mc-application-form" style={{ maxWidth: '420px' }}>
          <h2>Welcome, Hacker</h2>
          <p className="mc-form-disclaimer">Signed in as {session?.user?.email}</p>

          {!application && (
            <>
              <p className="mc-form-disclaimer">You haven't started an application yet.</p>
              <Link to="/apply" className="mc-button" style={{ display: 'inline-flex', textDecoration: 'none' }}>Start your application</Link>
            </>
          )}

          {application && (
            <dl>
              <div style={{ borderBottom: '1px solid #a3ae97', padding: '13px 0' }}>
                <dt style={{ fontSize: '12px', color: '#5d6e52' }}>Status</dt>
                <dd style={{ fontSize: '15px', margin: '4px 0 0' }}>{application.status}</dd>
              </div>
              {application.submitted_at && (
                <div style={{ padding: '13px 0' }}>
                  <dt style={{ fontSize: '12px', color: '#5d6e52' }}>Submitted</dt>
                  <dd style={{ fontSize: '15px', margin: '4px 0 0' }}>{new Date(application.submitted_at).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </MinecraftLayout>
  )
}