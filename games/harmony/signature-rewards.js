export const SIGNATURE_AUGMENT_TIERS = Object.freeze([1, 2, 3, 4]);
export const SIGNATURE_AUGMENT_KINDS = Object.freeze(["relic", "trait"]);

export function isSignatureOnlyAugment(item) {
  return item?.signatureOnly === true;
}

export function isGeneralAugmentCandidate(item) {
  return Boolean(item && !isSignatureOnlyAugment(item));
}

export function signatureBossEntries(bossTables = []) {
  return bossTables.flatMap((table) => Object.values(table || {}));
}

export function signatureRewardOwners(bossTables = []) {
  const owners = new Map();
  for (const boss of signatureBossEntries(bossTables)) {
    if (!boss?.signatureReward) continue;
    const list = owners.get(boss.signatureReward) || [];
    list.push(boss.id);
    owners.set(boss.signatureReward, list);
  }
  return owners;
}

export function validateSignatureRewardPolicy(items, bossTables = []) {
  const issues = [],
    bosses = signatureBossEntries(bossTables),
    owners = signatureRewardOwners(bossTables),
    validTiers = new Set(SIGNATURE_AUGMENT_TIERS),
    validKinds = new Set(SIGNATURE_AUGMENT_KINDS);

  for (const boss of bosses) {
    if (!boss?.signatureReward) continue;
    const item = items?.[boss.signatureReward];
    if (!boss.unlockId)
      issues.push(`${boss.id}: signatureReward 보스는 unlockId가 필요합니다.`);
    if (!item) {
      issues.push(`${boss.id}: signatureReward ${boss.signatureReward}가 ITEMS에 없습니다.`);
      continue;
    }
    if (!isSignatureOnlyAugment(item))
      issues.push(`${boss.id}: ${item.id}에 signatureOnly: true가 필요합니다.`);
    if (!validKinds.has(item.kind))
      issues.push(`${boss.id}: ${item.id}의 kind는 relic 또는 trait이어야 합니다.`);
    if (!validTiers.has(item.tier))
      issues.push(`${boss.id}: ${item.id}의 tier는 1~4여야 합니다.`);
  }

  for (const item of Object.values(items || {})) {
    if (!isSignatureOnlyAugment(item)) continue;
    const linkedBosses = owners.get(item.id) || [];
    if (!validKinds.has(item.kind))
      issues.push(`${item.id}: Signature 증강은 relic 또는 trait이어야 합니다.`);
    if (!validTiers.has(item.tier))
      issues.push(`${item.id}: Signature 증강의 tier는 1~4여야 합니다.`);
    if (linkedBosses.length !== 1)
      issues.push(`${item.id}: 지정 보스가 정확히 1명이어야 합니다. 현재 ${linkedBosses.length}명.`);
  }

  return issues;
}

export function assertSignatureRewardPolicy(items, bossTables = []) {
  const issues = validateSignatureRewardPolicy(items, bossTables);
  if (issues.length)
    throw new Error(`Signature reward policy violation:\n- ${issues.join("\n- ")}`);
  return true;
}
