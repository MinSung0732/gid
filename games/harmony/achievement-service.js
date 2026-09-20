import { getSupabaseClient } from "./supabase-client.js";

export async function fetchAchievementSummary(client = null) {
  const supabase = client || await getSupabaseClient();
  const { data, error } = await supabase.rpc("get_harmony_achievement_summary");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
