import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const finishLogin = async () => {
      const role = searchParams.get('role')

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('No session found. Please try signing in again.')
        return
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          email: session.user.email,
          role: role,
        })

      if (upsertError) {
        setError(upsertError.message)
        return
      }

      // Mentors, judges and hybrids go to /portal, which opens the portal for what their
      // application says they are, whichever sign-in button they used.
      navigate(role === 'mentor' || role === 'judge' ? '/portal' : `/dashboard/${role}`, { replace: true })
    }

    finishLogin()
  }, [searchParams, navigate])

  if (error) return <div>Something went wrong: {error}</div>
  return <div>Signing you in...</div>
}