import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const workspaceId = import.meta.env.VITE_FINANCE_WORKSPACE_ID || 'vitor'

export const CLOUD_ENABLED = Boolean(supabaseUrl && supabaseAnonKey)

const supabase = CLOUD_ENABLED ? createClient(supabaseUrl, supabaseAnonKey) : null

export async function getCloudSession() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function onCloudAuthChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function signInCloud(email, password) {
  if (!supabase) return null
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signUpCloud(email, password) {
  if (!supabase) return null
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data.session
}

export async function signOutCloud() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function loadCloudData(userId) {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('finance_snapshots')
    .select('data')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw error
  return data?.data || null
}

export async function saveCloudData(userId, data) {
  if (!supabase) return

  const { error } = await supabase
    .from('finance_snapshots')
    .upsert({
      user_id: userId,
      workspace_id: workspaceId,
      data,
      updated_at: new Date().toISOString()
    })

  if (error) throw error
}
