import { loadGame, saveGame } from "./persistence.js?v=20260915-2";
import {
  campaignClearKey,
  clearMilestone,
  hasCampaignClear,
  markClearProgress,
} from "./campaign-progression.js";

let scheduled = false;
let writing = false;

function storage() {
  return globalThis.window?.HarmonyRuntime?.storage || null;
}

export function persistReachedCampaignClear() {
  if (writing) return false;
  const target = storage();
  if (!target) return false;
  let loaded;
  try {
    loaded = loadGame(target);
  } catch {
    return false;
  }
  const run = loaded?.run,
    meta = loaded?.meta;
  if (!run || run.phase !== "loop" || !meta) return false;
  const key = campaignClearKey(run);
  if (!key || hasCampaignClear(meta, key)) return false;

  const milestone = clearMilestone(run, meta);
  markClearProgress(run, meta, milestone);
  try {
    writing = true;
    saveGame(target, { meta, run }, loaded.revision || 0);
  } catch {
    return false;
  } finally {
    writing = false;
  }
  globalThis.window?.dispatchEvent?.(new CustomEvent("harmony:campaign-clear-recorded"));
  return true;
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    persistReachedCampaignClear();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("DOMContentLoaded", schedule);
  window.addEventListener("harmony:cloud-status", schedule);
  schedule();
}
