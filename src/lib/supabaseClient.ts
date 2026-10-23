import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Dev only: a tab opened from /dev/test-accounts keeps its login in this tab
 * (sessionStorage) instead of the whole browser, so several dummy applicants
 * and an organizer can be signed in side by side. Never on in a build.
 */
const testTab = import.meta.env.DEV && typeof window !== 'undefined' && (() => {
  try {
    if (new URLSearchParams(window.location.search).has('testAs')) window.sessionStorage.setItem('datahacks.testTab', '1')
    return window.sessionStorage.getItem('datahacks.testTab') === '1'
  } catch {
    return false
  }
})()

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  testTab ? { auth: { storage: window.sessionStorage, storageKey: 'sb-test-tab' } } : undefined,
)
