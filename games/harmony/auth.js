import { getSupabaseClient } from "./supabase-client.js";

export const AUTH_REDIRECT_URL = "https://minsung0732.github.io/gid/games/harmony/";
const LAST_USER_KEY = "harmony_auth_last_user_id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cacheUserId(storage, userId) {
  try {
    if (UUID_PATTERN.test(userId || "")) storage.setItem(LAST_USER_KEY, userId);
  } catch {}
}

export function clearCachedUserId(storage) {
  try {
    storage.removeItem(LAST_USER_KEY);
  } catch {}
}

export function getCachedUserId(storage) {
  try {
    const userId = storage.getItem(LAST_USER_KEY);
    return UUID_PATTERN.test(userId || "") ? userId : null;
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return { client, session: data.session, user: data.session?.user || null };
}

export async function signInWithProvider(provider) {
  if (!["kakao", "google"].includes(provider))
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: AUTH_REDIRECT_URL },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function fetchProfile(client, userId) {
  if (!client || !userId) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, avatar_url, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export function profileFallback(user) {
  const metadata = user?.user_metadata || {};
  const emailName = user?.email?.split("@")[0] || "Harmony 회원";
  return {
    id: user?.id || null,
    display_name:
      metadata.display_name ||
      metadata.full_name ||
      metadata.name ||
      metadata.nickname ||
      emailName,
    avatar_url: metadata.avatar_url || metadata.picture || null,
  };
}

export async function subscribeAuthState(callback) {
  const client = await getSupabaseClient();
  const { data } = client.auth.onAuthStateChange((event, session) => {
    callback?.({ event, session, user: session?.user || null });
  });
  return data.subscription;
}
