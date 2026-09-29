export const SUPABASE_URL = "https://kjoqywibjeezhfulgven.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BtS5IcUKwi1emCONR5aTBQ_ASo_OOyR";
export const SUPABASE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm";
export const SUPABASE_HEALTH_URL = `${SUPABASE_URL}/auth/v1/health`;

let clientPromise = null;

function timeout(ms) {
  return new Promise((_, reject) => {
    globalThis.setTimeout(
      () => reject(new Error("Supabase client load timeout")),
      ms,
    );
  });
}

export async function probeSupabaseReachability({
  fetchImpl = globalThis.fetch,
  timeoutMs = 1200,
} = {}) {
  if (typeof fetchImpl !== "function") return false;
  const controller = new AbortController(),
    timer = globalThis.setTimeout(
      () => controller.abort("Supabase reachability timeout"),
      Math.max(250, Number(timeoutMs) || 1200),
    );
  try {
    await fetchImpl(SUPABASE_HEALTH_URL, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = Promise.race([
      import(SUPABASE_MODULE_URL).then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            persistSession: true,
            // Avoid an idle refresh loop when the auth host is temporarily
            // unreachable. Expired sessions can still refresh on explicit
            // session/cloud work after connectivity has been confirmed.
            autoRefreshToken: false,
            detectSessionInUrl: true,
          },
        }),
      ),
      timeout(4000),
    ]).catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}
