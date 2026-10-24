import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import MinecraftLayout from '@/components/MinecraftLayout'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { signOutEverywhere, startGoogleSignIn } from '@/portal/signIn'

type State =
  | { step: 'loading' }
  | { step: 'sign-in' }
  | { step: 'consent'; details: OAuthAuthorizationDetails }
  | { step: 'leaving' }
  | { step: 'error'; message: string }

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Where the assistant's sign-in returns to, so a person can tell a real app from one that only borrowed its name. */
const returnsTo = (uri: string) => {
  try {
    const url = new URL(uri)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.host : url.protocol.replace(/:$/, '')
  } catch {
    return uri
  }
}

/**
 * /oauth/consent: an AI assistant (an MCP client such as Claude or ChatGPT) wants
 * to use the DataHacks MCP server for someone. Supabase Auth's OAuth server sends
 * them here with an authorization_id; they sign in with Google if they haven't,
 * then allow or deny. Allowing lets that assistant see their application and
 * submit one for them, as them and nothing more (row-level security still
 * applies). See supabase/functions/mcp.
 */
export default function OAuthConsent() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const authorizationId = params.get('authorization_id')
  const [state, setState] = useState<State>({ step: 'loading' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!authorizationId) return setState({ step: 'error', message: 'This link is missing its authorization request. Start connecting again from your AI assistant.' })
    if (loading) return
    if (!session) return setState({ step: 'sign-in' })

    let cancelled = false
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) return setState({ step: 'error', message: error?.message ?? 'That authorization request has expired. Start connecting again from your AI assistant.' })
      // Already allowed this assistant before: straight back to it.
      if (!('authorization_id' in data)) {
        setState({ step: 'leaving' })
        window.location.href = data.redirect_url
        return
      }
      setState({ step: 'consent', details: data })
    })
    return () => { cancelled = true }
  }, [authorizationId, session, loading])

  const signIn = () => startGoogleSignIn('hacker', `${pathname}${search}`).catch(e => setState({ step: 'error', message: message(e) }))

  const decide = async (allow: boolean) => {
    if (!authorizationId) return
    setBusy(true)
    const { data, error } = allow
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
    if (error || !data) {
      setBusy(false)
      return setState({ step: 'error', message: error?.message ?? 'Something went wrong. Start connecting again from your AI assistant.' })
    }
    setState({ step: 'leaving' })
    window.location.href = data.redirect_url
  }

  const switchAccount = async () => {
    await signOutEverywhere()
    setState({ step: 'sign-in' })
  }

  return (
    <MinecraftLayout>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="mc-application-form" style={{ maxWidth: '440px', textAlign: 'center' }}>
          <h2>Connect an AI assistant</h2>

          {state.step === 'loading' && <p className="mc-form-disclaimer">Loading…</p>}

          {state.step === 'sign-in' && (
            <>
              <p className="mc-form-disclaimer">
                An AI assistant wants to help with your DataHacks application. Sign in with Google to choose whether to let it.
                New here? Signing in creates your account.
              </p>
              <button className="mc-button" onClick={signIn} style={{ width: '100%' }}>Continue with Google</button>
            </>
          )}

          {state.step === 'consent' && (
            <>
              <p className="mc-form-disclaimer">
                <strong>{state.details.client.name || 'An AI assistant'}</strong> wants to use your DataHacks account
                ({state.details.user.email}) to:
              </p>
              <ul className="mc-form-disclaimer" style={{ textAlign: 'left' }}>
                <li>see your application for this year's DataHacks and its status</li>
                <li>submit an application for you, as a hacker, mentor or judge, with the answers you give it</li>
              </ul>
              <p className="mc-form-disclaimer">
                Allowing sends you back to <strong>{returnsTo(state.details.redirect_uri)}</strong>. Any app can call itself
                by any name, so check that this is the assistant you just connected.
              </p>
              <p className="mc-form-disclaimer">
                It can't see anyone else's application or change one after it's submitted. Only allow assistants you trust.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="mc-button" onClick={() => decide(false)} disabled={busy} style={{ flex: 1 }}>Deny</button>
                <button className="mc-button" onClick={() => decide(true)} disabled={busy} style={{ flex: 1 }}>Allow</button>
              </div>
              <p className="mc-form-disclaimer">
                Not you? <button type="button" onClick={switchAccount} disabled={busy} style={{ textDecoration: 'underline' }}>Use another account</button>
              </p>
            </>
          )}

          {state.step === 'leaving' && <p className="mc-form-disclaimer">Taking you back to your assistant…</p>}

          {state.step === 'error' && <p className="mc-form-disclaimer" style={{ color: '#c96b6b' }}>{state.message}</p>}
        </div>
      </div>
    </MinecraftLayout>
  )
}
