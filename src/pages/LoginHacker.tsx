import { supabase } from '@/lib/supabaseClient'
import MinecraftLayout from '@/components/MinecraftLayout'

export default function LoginHacker() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?role=hacker`,
      },
    })
    if (error) console.error('OAuth error:', error)
  }

  return (
    <MinecraftLayout>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="mc-application-form" style={{ maxWidth: '380px', textAlign: 'center' }}>
          <h2>Hacker Sign In</h2>
          <p className="mc-form-disclaimer">Sign in with Google to start or continue your application.</p>
          <button className="mc-button" onClick={handleLogin} style={{ width: '100%' }}>Continue with Google</button>
        </div>
      </div>
    </MinecraftLayout>
  )
}