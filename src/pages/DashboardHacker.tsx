import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { Link } from 'react-router-dom'

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

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome, Hacker</h1>
      <p>Signed in as {session?.user?.email}</p>

      {!application && (
        <>
          <p>You haven't started an application yet.</p>
          <Link to="/apply">Start your application</Link>
        </>
      )}

      {application && (
        <div>
          <p>Application status: <strong>{application.status}</strong></p>
          {application.submitted_at && (
            <p>Submitted: {new Date(application.submitted_at).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  )
}