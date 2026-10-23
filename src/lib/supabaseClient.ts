import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Dev only: a tab opened from /dev/test-accounts keeps its login in this tab
 * (sessionStorage) instead of the whole browser, so several dummy applicants
 * and an organizer can be signed in side by side. Each dummy gets its own
 * storage key: Supabase syncs logins between tabs that share one, which would
 * hand every test tab the most recent sign-in. Never on in a build.
 */
const testAccount = import.meta.env.DEV && typeof window !== 'undefined' ? (() => {
  try {
    const as = new URLSearchParams(window.location.search).get('testAs')
    if (as) window.sessionStorage.setItem('datahacks.testTab', as)
    return window.sessionStorage.getItem('datahacks.testTab')
  } catch {
    return null
  }
})() : null

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  testAccount ? { auth: { storage: window.sessionStorage, storageKey: `sb-test-${testAccount}` } } : undefined,
)
