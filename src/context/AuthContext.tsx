import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Session } from '@supabase/supabase-js'
import type { Role } from '@/portal/paths'
import { currentEventId } from '@/portal/event'

type AuthContextType = {
  session: Session | null
  /** This person's role at the current event, from event_roles. Never taken from the URL. */
  role: Role | null
  /** Has the organizer role at the current event: opens the organizer console. */
  isOrganizer: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ session: null, role: null, isOrganizer: false, loading: true })

/** event_roles rows are granted when an application is accepted; a hybrid has both. */
async function fetchRoles(userId: string): Promise<{ role: Role; isOrganizer: boolean }> {
  const eventId = await currentEventId()
  const { data, error } = await supabase.from('event_roles').select('role').eq('user_id', userId).eq('event_id', eventId)
  if (error) throw error
  const roles = new Set((data ?? []).map(row => row.role as string))
  const isOrganizer = roles.has('organizer')
  if (roles.has('mentor') && roles.has('judge')) return { role: 'hybrid', isOrganizer }
  if (roles.has('mentor')) return { role: 'mentor', isOrganizer }
  if (roles.has('judge')) return { role: 'judge', isOrganizer }
  return { role: 'hacker', isOrganizer }
}

/** The roles read from event_roles, and the account they were read for. */
type Roles = { userId: string; role: Role; isOrganizer: boolean }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [roles, setRoles] = useState<Roles | null>(null)
  // Set once Supabase confirms there's no saved session, so a signed-out visitor
  // isn't sent to sign in before a stored session has had the chance to load.
  const [signedOut, setSignedOut] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Roles are only ever granted by the database.
  const userId = session?.user.id
  useEffect(() => {
    let current = true
    if (!userId) {
      // Signed out: forget the last account's roles, so signing back in reads them afresh.
      setRoles(null)
      supabase.auth.getSession().then(({ data }) => {
        if (current && !data.session) setSignedOut(true)
      })
      return () => { current = false }
    }
    fetchRoles(userId)
      .catch(error => {
        // Signed in but the role can't be read: treat them as a hacker, which
        // grants nothing. The data itself is still protected by the database.
        console.error('Could not read role:', error)
        return { role: 'hacker' as const, isOrganizer: false }
      })
      .then(next => {
        if (current) setRoles({ userId, ...next })
      })
    return () => { current = false }
  }, [userId])

  // Roles count only for the account they were read for. When another tab signs
  // this browser in as someone else, the session changes a render before the new
  // account's roles are read; until they arrive this is loading, so a guarded page
  // (the organizer console) never renders with the previous account's roles.
  const mine = userId && roles?.userId === userId ? roles : null
  const loading = userId ? !mine : !signedOut

  return (
    <AuthContext.Provider value={{ session, role: mine?.role ?? null, isOrganizer: mine?.isOrganizer ?? false, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
