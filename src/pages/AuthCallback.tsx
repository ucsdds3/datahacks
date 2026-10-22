import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { portal } from '@/portal/paths'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const finishLogin = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('No session found. Please try signing in again.')
        return
      }

      // No role is sent. The database sets it from the organizers' allowlist,
      // and overwrites anything a request claims.
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, email: session.user.email })

      if (upsertError) {
        setError(upsertError.message)
        return
      }

      const { data: profile, error: readError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const role = profile?.role
      if (readError || (role !== 'hacker' && role !== 'judge' && role !== 'mentor')) {
        setError('Your account has no role yet. Please contact info@ds3.club.')
        return
      }

      // Wherever they signed in from, they land in the area their role allows.
      navigate(portal.dashboard(role), { replace: true })
    }

    finishLogin()
  }, [navigate])

  if (error) return <div>Something went wrong: {error}</div>
  return <div>Signing you in...</div>
}