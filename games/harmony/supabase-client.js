export const SUPABASE_URL = "https://kjoqywibjeezhfulgven.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BtS5IcUKwi1emCONR5aTBQ_ASo_OOyR";
const SUPABASE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let clientPromise = null;

function timeout(ms) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("Supabase client load timeout")), ms);
  });
}

export async function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = Promise.race([
      import(SUPABASE_MODULE_URL).then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
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
