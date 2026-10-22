import { supabase } from '@/lib/supabaseClient'
import MinecraftLayout from '@/components/MinecraftLayout'
import { portal } from '@/portal/paths'

export default function LoginJudge() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${portal.callback}?as=staff`,
      },
    })
    if (error) console.error('OAuth error:', error)
  }

  return (
    <MinecraftLayout>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="mc-application-form" style={{ maxWidth: '380px', textAlign: 'center' }}>
          <h2>Judge Sign In</h2>
          <p className="mc-form-disclaimer">Sign in with Google to apply, or to open your portal if you already have.</p>
          <button className="mc-button" onClick={handleLogin} style={{ width: '100%' }}>Continue with Google</button>
        </div>
      </div>
    </MinecraftLayout>
  )
}