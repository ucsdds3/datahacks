import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { applyPath, portal, rememberApplyAs } from '@/portal/paths'
import { currentEventId } from '@/portal/event'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Which sign-in button was used. It only picks where to go next; it never
    // grants anything, so it's fine that anyone can edit it in the URL.
    const as = searchParams.get('as')
    if (as === 'staff' || as === 'hacker') rememberApplyAs(as)

    const finishLogin = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('No session found. Please try signing in again.')
        return
      }

      // No role is sent: roles are granted per event when an application is
      // accepted (event_roles), and the database ignores any role a request claims.
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, email: session.user.email })

      if (upsertError) {
        setError(upsertError.message)
        return
      }

      // Signed in to approve an AI assistant: back to the consent page. Only that
      // page, since anyone can edit the URL.
      const returnTo = searchParams.get('next')
      if (returnTo?.startsWith(`${portal.oauthConsent}?`)) {
        navigate(returnTo, { replace: true })
        return
      }

      // Organizers go to the console. Anyone who has applied goes to the portal,
      // which opens on their status; someone new goes to the form for the
      // sign-in they used (hacker, or mentor/judge).
      let eventId: string
      try {
        eventId = await currentEventId()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return
      }

      const { data: application, error: readError } = await supabase
        .from('applications')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('event_id', eventId)
        .limit(1)
        .maybeSingle()

      if (readError) {
        setError(readError.message)
        return
      }

      // Not applied yet: straight to the form for the sign-in page they used.
      const next = as === 'organizer' ? portal.organizer : application ? portal.home : applyPath()
      navigate(next, { replace: true })
    }

    finishLogin()
  }, [searchParams, navigate])

  if (error) return <div>Something went wrong: {error}</div>
  return <div>Signing you in...</div>
}
