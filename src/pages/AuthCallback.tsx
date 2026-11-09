import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { applyPath, portal, rememberApplyAs, safeNext } from '@/portal/paths'
import { currentEventId } from '@/portal/event'
import { Screen } from '@/staff-portal/StaffGate'
import { GENERAL_CONTACT_EMAIL } from '@/staff-portal/config'
import { friendlyError } from '@/lib/friendlyError'

/** The sign-in page to go back to, for the button that was used. */
const signInPage = (as: string | null) =>
  as === 'organizer' ? portal.organizerLogin : as === 'staff' ? portal.login('mentor') : portal.login('hacker')

/**
 * Google (through Supabase) sends sign-in failures back as ?error=… or #error=…:
 * access_denied when the person cancelled at the account picker.
 */
function providerError(search: URLSearchParams): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const code = search.get('error') ?? hash.get('error')
  if (!code) return null
  const description = search.get('error_description') ?? hash.get('error_description') ?? ''
  console.error('Sign-in failed:', code, description)
  if (code === 'access_denied') return 'Sign-in was cancelled, so you weren\'t signed in. Try again whenever you\'re ready.'
  if (/expired/i.test(description)) return 'That sign-in link has expired. Please sign in again.'
  return 'Google sign-in didn\'t finish. Please try signing in again.'
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const as = searchParams.get('as')

  useEffect(() => {
    // Which sign-in button was used. It only picks where to go next; it never
    // grants anything, so it's fine that anyone can edit it in the URL.
    if (as === 'staff' || as === 'hacker') rememberApplyAs(as)

    const fail = (e: unknown) => {
      console.error('Sign-in callback failed:', e)
      setError(friendlyError(e))
    }

    const finishLogin = async () => {
      const cancelled = providerError(searchParams)
      if (cancelled) return setError(cancelled)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('We couldn\'t finish signing you in. The sign-in may have expired or been opened in a different browser. Please sign in again.')
        return
      }

      // No role is sent: roles are granted per event when an application is
      // accepted (event_roles), and the database ignores any role a request claims.
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, email: session.user.email })

      if (upsertError) return fail(upsertError)

      // Signed in to approve an AI assistant: back to the consent page. Only that
      // page, since anyone can edit the URL.
      const returnTo = searchParams.get('next')
      if (returnTo?.startsWith(`${portal.oauthConsent}?`)) {
        navigate(returnTo, { replace: true })
        return
      }

      // Organizers go to the console. Anyone who has applied goes to the portal,
      // which opens on their status (or the portal page that sent them to sign in);
      // someone new goes to the form for the sign-in they used (hacker, or mentor/judge).
      let eventId: string
      try {
        eventId = await currentEventId()
      } catch (e) {
        return fail(e)
      }

      const { data: application, error: readError } = await supabase
        .from('applications')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('event_id', eventId)
        .limit(1)
        .maybeSingle()

      if (readError) return fail(readError)

      // Not applied yet: straight to the form for the sign-in page they used.
      const next = as === 'organizer' ? portal.organizer : application ? safeNext(returnTo) ?? portal.home : applyPath()
      navigate(next, { replace: true })
    }

    finishLogin().catch(fail)
  }, [as, searchParams, navigate])

  if (error) {
    return (
      <Screen title="Something went wrong">
        <p className="sp-error" role="alert">{error}</p>
        <Link className="sp-button primary sp-signin-button" to={signInPage(as)} replace>Back to sign in</Link>
        <p>Still stuck? Email <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a>.</p>
      </Screen>
    )
  }
  return <Screen title="Signing you in…" />
}
