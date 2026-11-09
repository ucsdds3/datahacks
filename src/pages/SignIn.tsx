import { Link, useSearchParams } from 'react-router-dom'
import { Screen } from '@/staff-portal/StaffGate'
import { MCP_LIVE } from '@/pages/applyWithAiConfig'
import { safeNext } from '@/portal/paths'
import { useAuth } from '@/context/AuthContext'
import { AccountNotice } from '@/portal/AccountNotice'
import { useAccountGuard } from '@/portal/useAccountGuard'
import type { SignInAs } from '@/portal/signIn'

const COPY: Record<SignInAs, { title: string; text: string }> = {
  hacker: { title: 'Hacker Sign In', text: 'Sign in with Google to apply as a hacker, or to open your portal if you already have.' },
  // "and", not "&": the pixel heading font draws "&" like a "$".
  staff: { title: 'Mentor and Judge Sign In', text: 'Sign in with Google to apply as a mentor or judge, or to open your portal if you already have.' },
  organizer: { title: 'Organizer Sign In', text: 'For DataHacks organizers. Sign in with the Google account that was added as an organizer.' },
}

/**
 * The sign-in pages (/login/hacker, /login/mentor, /login/judge, /organizer).
 * The site's buttons skip these and go straight to Google; these are for links
 * people save or share, and where signing out lands.
 *
 * Already signed in? The whole site shares one session per browser, so instead
 * of starting Google (and replacing that account everywhere) it asks: continue
 * as that account, or use a different one.
 */
export default function SignIn({ as }: { as: SignInAs }) {
  const { session, isOrganizer, loading } = useAuth()
  // A portal page that sent them here to sign in: back there afterwards.
  const [params] = useSearchParams()
  const next = as === 'organizer' ? null : safeNext(params.get('next'))
  const guard = useAccountGuard(as, { signedInAs: session ? session.user.email ?? '' : null, next: next ?? undefined })
  const { title, text } = COPY[as]
  // The organizer check needs the role, which arrives just after the session.
  const notOrganizer = as === 'organizer' && !!session && !loading && !isOrganizer

  return (
    <Screen title={title}>
      <p>{text}</p>
      <div aria-live="polite">
        {guard.account !== null && (
          <AccountNotice
            theme="sp"
            email={guard.account}
            notOrganizer={notOrganizer}
            busy={guard.busy}
            onContinue={guard.continueAsCurrent}
            onSwitch={guard.switchAccount}
          />
        )}
      </div>
      {guard.account === null && <button className="sp-button primary sp-signin-button" onClick={guard.signIn}>Continue with Google</button>}
      {guard.error && <p className="sp-error" role="alert">{guard.error}</p>}
      {/* Only once signing in from an assistant works: until then the page is a dead end. */}
      {as !== 'organizer' && MCP_LIVE && <p className="sp-signin-alt">Rather apply by chatting with an AI assistant? <Link to="/apply-with-ai">Apply with AI</Link></p>}
    </Screen>
  )
}
