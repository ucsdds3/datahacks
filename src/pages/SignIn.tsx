import { useState } from 'react'
import MinecraftLayout from '@/components/MinecraftLayout'
import { startGoogleSignIn, type SignInAs } from '@/portal/signIn'

const COPY: Record<SignInAs, { title: string; text: string }> = {
  hacker: { title: 'Hacker Sign In', text: 'Sign in with Google to apply as a hacker, or to open your portal if you already have.' },
  staff: { title: 'Mentor & Judge Sign In', text: 'Sign in with Google to apply as a mentor or judge, or to open your portal if you already have.' },
  organizer: { title: 'Organizer Sign In', text: 'For DataHacks organizers. Sign in with the Google account that was added as an organizer.' },
}

/**
 * The sign-in pages (/login/hacker, /login/mentor, /login/judge, /organizer).
 * The site's buttons skip these and go straight to Google; these are for links
 * people save or share, and where signing out lands.
 */
export default function SignIn({ as }: { as: SignInAs }) {
  const [error, setError] = useState<string | null>(null)
  const { title, text } = COPY[as]

  const signIn = () => startGoogleSignIn(as).catch(e => setError(e instanceof Error ? e.message : String(e)))

  return (
    <MinecraftLayout>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="mc-application-form" style={{ maxWidth: '380px', textAlign: 'center' }}>
          <h2>{title}</h2>
          <p className="mc-form-disclaimer">{text}</p>
          <button className="mc-button" onClick={signIn} style={{ width: '100%' }}>Continue with Google</button>
          {error && <p className="mc-form-disclaimer" style={{ color: '#c96b6b' }}>{error}</p>}
        </div>
      </div>
    </MinecraftLayout>
  )
}
