import { supabase } from '@/lib/supabaseClient'

export default function LoginHacker() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?role=hacker`,
      },
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
      <h1>Hacker Sign In</h1>
      <button onClick={handleLogin}>Continue with Google</button>
    </div>
  )
}