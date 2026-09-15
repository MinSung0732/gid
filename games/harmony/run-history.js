import { GAME_VERSION } from "./version.js?v=20260915-2";

const recordedRunIds = new Set();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildRunResultRow(userId, run, record) {
  if (!userId || !UUID_PATTERN.test(run?.runId || "")) return null;
  return {
    run_id: run.runId,
    user_id: userId,
    score: Math.max(0, Math.floor(Number(record?.score) || 0)),
    loop: Math.max(0, Math.floor(Number(record?.loop) || 0)),
    room: Math.max(0, Math.floor(Number(record?.room) || 0)),
    cleared: Boolean(record?.cleared),
    hp: Math.max(0, Number(record?.hp) || 0),
    max_hp: Math.max(1, Number(record?.maxHp) || 1),
    attack: Math.max(0, Number(record?.attack) || 0),
    defense: Math.max(0, Number(record?.defense) || 0),
    deck_count: Math.max(0, Math.floor(Number(record?.deckCount) || 0)),
    max_hit: Math.max(0, Number(record?.maxHit) || 0),
    seed: Number.isFinite(Number(run.seed)) ? Number(run.seed) : null,
    summary: {
      items: Array.isArray(record?.items) ? record.items : [],
      won: Boolean(run.won),
      phase: run.phase,
    },
    verified: false,
    client_version: GAME_VERSION,
    client_finished_at: new Date().toISOString(),
  };
}

export function createRunHistory({ client, userId, onStatus }) {
  async function record(run, record) {
    const row = buildRunResultRow(userId, run, record);
    if (!client || !row || recordedRunIds.has(row.run_id)) return false;
    recordedRunIds.add(row.run_id);
    const { error } = await client.from("run_results").insert(row);
    if (!error) {
      onStatus?.({ status: "recorded", runId: row.run_id });
      return true;
    }
    if (error.code === "23505") return true;
    recordedRunIds.delete(row.run_id);
    onStatus?.({ status: "error", error, runId: row.run_id });
    return false;
  }
  return Object.freeze({ record });
}
