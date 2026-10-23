import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { portal } from '@/portal/paths'
import { TEST_ACCOUNTS } from './accounts'

/**
 * `/dev/test-accounts`, only in `npm run dev`: open a dummy applicant's portal
 * in a tab of its own. Each tab keeps its own login, so several can be open
 * next to the organizer console.
 */
export default function TestAccounts() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const as = params.get('testAs')
  const go = params.get('go')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!as) return
    const password = import.meta.env.VITE_DEV_TEST_PASSWORD as string | undefined
    if (!password) {
      setError('Add VITE_DEV_TEST_PASSWORD to .env.local and restart npm run dev.')
      return
    }
    supabase.auth.signInWithPassword({ email: as, password }).then(({ error: signInError }) => {
      if (signInError) setError(signInError.message)
      // ?go=/portal/apply/mentor-judge lands a fresh account on that form.
      else navigate(go?.startsWith('/portal') ? go : portal.home, { replace: true })
    })
  }, [as, go, navigate])

  if (as) {
    return <main style={{ padding: 32, fontFamily: 'system-ui' }}>{error ? <p>Couldn't sign in as {as}: {error}</p> : <p>Signing in as {as}…</p>}</main>
  }

  return (
    <main style={{ maxWidth: 640, padding: 32, fontFamily: 'system-ui', lineHeight: 1.5 }}>
      <h1>Test accounts (dev only)</h1>
      <p>Each link opens that dummy applicant's portal in a new tab with its own login.</p>
      <ul>
        {TEST_ACCOUNTS.map(a => (
          <li key={a.email}>
            <a href={`/dev/test-accounts?testAs=${encodeURIComponent(a.email)}`} target="_blank" rel="noreferrer">
              {a.name}
            </a>{' '}
            · {a.kind} · <code>{a.email}</code>
          </li>
        ))}
      </ul>
    </main>
  )
}
