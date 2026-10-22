import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Session } from '@supabase/supabase-js'
import type { Role } from '@/portal/paths'
import { currentEventId } from '@/portal/event'

type AuthContextType = {
  session: Session | null
  /** This person's role at the current event, from event_roles. Never taken from the URL. */
  role: Role | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ session: null, role: null, loading: true })

/** event_roles rows are granted when an application is accepted; a hybrid has both. */
async function fetchRole(userId: string): Promise<Role> {
  const eventId = await currentEventId()
  const { data, error } = await supabase.from('event_roles').select('role').eq('user_id', userId).eq('event_id', eventId)
  if (error) throw error
  const roles = new Set((data ?? []).map(row => row.role as string))
  if (roles.has('mentor') && roles.has('judge')) return 'hybrid'
  if (roles.has('mentor')) return 'mentor'
  if (roles.has('judge')) return 'judge'
  return 'hacker'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Roles are only ever granted by the database. loading stays true until the
  // role arrives, so a guarded page never renders on a guess.
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
    fetchRole(userId)
      .catch(error => {
        // Signed in but the role can't be read: treat them as a hacker, which
        // grants nothing. The data itself is still protected by the database.
        console.error('Could not read role:', error)
        return 'hacker' as const
      })
      .then(next => {
        if (!current) return
        setRole(next)
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
