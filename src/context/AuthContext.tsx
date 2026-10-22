import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Session } from '@supabase/supabase-js'
import { isRole, type Role } from '@/portal/paths'

type AuthContextType = {
  session: Session | null
  /** The role the database says this person has. Never taken from the URL. */
  role: Role | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ session: null, role: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  // The role is read back from the profile row, which only the database can set.
  // loading stays true until it arrives, so a guarded page never renders on a guess.
  const userId = session?.user.id
  useEffect(() => {
    let current = true
    if (!userId) {
      supabase.auth.getSession().then(({ data }) => {
        if (current && !data.session) { setRole(null); setLoading(false) }
      })
      return () => { current = false }
    }
    setLoading(true)
    supabase.from('profiles').select('role').eq('id', userId).maybeSingle().then(({ data }) => {
      if (!current) return
      setRole(isRole(data?.role) ? data.role : null)
      setLoading(false)
    })
    return () => { current = false }
  }, [userId])

  return (
    <AuthContext.Provider value={{ session, role, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
