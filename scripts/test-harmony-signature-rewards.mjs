import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACT1_BOSSES,
  ACT2_BOSSES,
  ACT3_BOSSES,
  ITEMS,
  TABLES,
  UNLOCKS,
} from "../games/harmony/data.js";
import * as Core from "../games/harmony/engine-core.js";
import {
  isSignatureOnlyAugment,
  signatureRewardOwners,
  validateSignatureRewardPolicy,
} from "../games/harmony/signature-rewards.js";

const bossTables = [ACT1_BOSSES, ACT2_BOSSES, ACT3_BOSSES],
  signatureIds = new Set(
    Object.values(ITEMS)
      .filter(isSignatureOnlyAugment)
      .map((item) => item.id),
  ),
  allUnlockedMeta = () => {
    const meta = Core.freshMeta();
    meta.unlocked = UNLOCKS.filter((entry) => !entry.legacy).map((entry) => entry.id);
    return meta;
  };

assert.ok(signatureIds.size > 0, "Signature Pool이 비어 있으면 안 됩니다.");
assert.deepEqual(
  validateSignatureRewardPolicy(ITEMS, bossTables),
  [],
  "signatureOnly/signatureReward 데이터 규칙이 깨졌습니다.",
);

const owners = signatureRewardOwners(bossTables);
for (const id of signatureIds)
  assert.equal(owners.get(id)?.length, 1, `${id}는 지정 보스 1명에게만 연결되어야 합니다.`);

// 일반 보상 드랍테이블은 Signature Pool을 확률 분모에 넣지 않는다.
const lootRooms = Object.entries(TABLES)
  .filter(([, table]) => Array.isArray(table?.kinds) && Array.isArray(table?.tiers))
  .map(([room]) => room);
for (const room of lootRooms) {
  for (let seed = 1; seed <= 300; seed++) {
    const state = {
      rng: seed,
      inventory: [],
      eventPowers: {},
      statuses: {},
    };
    const id = Core.rollLoot(state, room, allUnlockedMeta());
    assert.ok(!signatureIds.has(id), `${room} 일반 드랍에서 Signature 증강 ${id}가 등장했습니다.`);
  }
}

// 상점 후보 생성 단계에서도 Signature Pool을 먼저 제외한다.
for (let seed = 1; seed <= 120; seed++) {
  const meta = allUnlockedMeta(),
    state = Core.newRun(seed, null, meta);
  state.loop = 3;
  Core.rollShopOffers(state, meta);
  for (const offer of state.shopOffers || [])
    assert.ok(!signatureIds.has(offer.id), `상점에서 Signature 증강 ${offer.id}가 등장했습니다.`);
}

// 이벤트/특수방 후보와 보스 승리 보상 경로의 안전장치도 소스 레벨로 고정한다.
const coreSource = readFileSync(
  new URL("../games/harmony/engine-core.js", import.meta.url),
  "utf8",
);
assert.match(
  coreSource,
  /function availableItems[\s\S]*?!item\.signatureOnly[\s\S]*?predicate\(item\)/,
  "특수방/이벤트 후보 생성에서 signatureOnly 제외 규칙이 필요합니다.",
);
assert.match(
  coreSource,
  /function canBuyShopAugment[\s\S]*?item\.signatureOnly/,
  "상점 증강 후보 생성에서 signatureOnly 제외 규칙이 필요합니다.",
);
assert.match(
  coreSource,
  /const defeatedBoss = [\s\S]*?signature = defeatedBoss\?\.signatureReward[\s\S]*?if \(signature && ITEMS\[signature\]\) \{[\s\S]*?addInventoryItem\(s, signature, meta\)/,
  "지정 보스 처치 시 signatureReward를 확정 지급하는 경로가 필요합니다.",
);

console.log(
  `Harmony signature rewards OK: ${signatureIds.size} signature augments / ${owners.size} boss links`,
);
