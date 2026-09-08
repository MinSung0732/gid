import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import {
  facilities,
  cost,
  perSecond,
  freshState,
  offlineGain,
  compact,
  studioMultiplier,
  clickMultiplier,
} from "../games/scent-workshop/data.js";
assert.equal(facilities.length, 8);
assert.deepEqual(
  facilities.map(({ id }) => id),
  ["drop", "pink", "green", "volcanic", "blend", "aging", "display", "studio"],
);
assert.equal(facilities.find(({ id }) => id === "aging").rate, 180);
assert.equal(facilities.find(({ id }) => id === "studio").rate, 1200);
assert.equal(facilities.find(({ id }) => id === "studio").base, 5_000_000);
assert.equal(facilities.find(({ id }) => id === "studio").growth, 1.28);
assert.deepEqual(
  facilities.map(({ max }) => max),
  [1000, 300, 200, 150, 100, 75, 50, 30],
);
assert.equal(cost(facilities[0], 0), 15);
assert.equal(cost(facilities[0], 1), 19);
assert.equal(cost(facilities[0], 999), 609_595);
assert.equal(cost(facilities[1], 299), 267_242);
assert.equal(cost(facilities[6], 49), 8_893_054);
assert.equal(cost(facilities.at(-1), 0), 5_000_000);
assert.equal(cost(facilities.at(-1), 1), 6_400_000);
const state = freshState();
assert.equal(state.masterCelebrated, false);
state.owned.drop = 5;
state.owned.pink = 2;
assert.equal(perSecond(state.owned), 3);
state.lastSeen = 1_000;
assert.equal(offlineGain(state, 11_000), 30);
assert.equal(offlineGain(state, 20_000_000), 43_200);
state.owned.studio = 1;
assert.equal(studioMultiplier(state.owned), 1.08);
assert.equal(clickMultiplier(state.owned), 1);
assert.equal(perSecond(state.owned), (3 + 1200) * 1.08);
state.owned.studio = 30;
assert.equal(studioMultiplier(state.owned), 4.4);
assert.equal(clickMultiplier(state.owned), 2.5);
assert.equal(compact(999), "999");
assert.equal(compact(1500), "1.5k");
assert.equal(compact(12000), "12k");
assert.equal(compact(1.25e12), "1.25T");
assert.equal(compact(2.5e15), "2.5Qa");
assert.equal(compact(999e33), "999Dc");
assert.equal(compact(1e36), "1.00e36");
await Promise.all(
  ["4", "8", "32"].map((value) =>
    access(
      new URL(`../public/assets/object-2048/${value}.png`, import.meta.url),
    ),
  ),
);
await access(
  new URL(
    "../public/assets/scent-workshop/gyeoli-clicker.png",
    import.meta.url,
  ),
);
await Promise.all(
  ["pink", "green", "volcanic"].map((type) =>
    access(
      new URL(
        `../public/assets/scent-workshop/stone-${type}.png`,
        import.meta.url,
      ),
    ),
  ),
);
await Promise.all(
  ["blend", "aging", "display", "studio"].map((type) =>
    access(
      new URL(
        `../public/assets/scent-workshop/icon-${type}.png`,
        import.meta.url,
      ),
    ),
  ),
);
await Promise.all(
  ["pink", "green", "volcanic"].map((type) =>
    access(
      new URL(
        `../public/assets/scent-workshop/display-${type}.png`,
        import.meta.url,
      ),
    ),
  ),
);
await access(
  new URL(
    "../public/assets/scent-workshop/gyeoli-clicker-happy.png",
    import.meta.url,
  ),
);
const html = await readFile(
    new URL("../games/scent-workshop/index.html", import.meta.url),
    "utf8",
  ),
  css = await readFile(
    new URL("../games/scent-workshop/styles.css", import.meta.url),
    "utf8",
  ),
  main = await readFile(
    new URL("../games/scent-workshop/main.js", import.meta.url),
    "utf8",
  );
assert.match(html, /결이든 향기 공방/);
assert.match(html, /scent-workshop\/gyeoli-clicker\.png/);
assert.match(html, /id="workshop-stage"/);
assert.match(html, /id="purchase-message"/);
assert.match(html, /class="display-cabinet"/);
assert.match(html, /class="studio-building"/);
assert.match(html, /id="master-ending"/);
assert.match(html, /id="master-badge"/);
assert.match(html, /제품 보러가기/);
assert.match(html, /기록 공유하기/);
assert.match(html, /계속 공방 운영하기/);
assert.match(html, /scent-workshop\/icon-studio\.png/);
assert.match(html, /scent-workshop\/display-pink\.png/);
assert.match(html, /scent-workshop\/display-volcanic\.png/);
assert.match(html, /scent-workshop\/display-green\.png/);
assert.doesNotMatch(html, /scent-workshop\/gyeoli-clicker-happy\.png/);
assert.doesNotMatch(html, /class="heart"/);
assert.match(html, /aria-pressed="true">소리 켜짐/);
assert.match(css, /100dvh/);
assert.match(css, /overflow:\s*hidden/);
assert.match(css, /\.gyeoli img/);
assert.match(css, /@keyframes scent-shimmer/);
assert.match(css, /@keyframes gyeoli-reaction/);
assert.match(css, /@keyframes wisp-out/);
assert.doesNotMatch(css, /@keyframes stone-drop/);
assert.match(css, /\.workshop-effects \{\s*z-index: 0/);
assert.match(css, /@media\s*\(max-width:\s*520px\)/);
assert.match(css, /width:\s*135px/);
assert.match(
  css,
  /\.workshop-stage \.stage-level[\s\S]*display:\s*none !important/,
);
assert.match(css, /\.display-cabinet[\s\S]*top:\s*70px/);
assert.match(css, /data-blend="3"[\s\S]*transform:\s*scale\(0\.62\)/);
assert.match(css, /\.stone-pile\.denser/);
assert.match(css, /\.pile-stone[\s\S]*?opacity:\s*0\.9/);
assert.match(css, /object-fit:\s*contain/);
assert.match(css, /\.blend-table i:nth-of-type\(1\)/);
assert.doesNotMatch(css, /\.blend-table i:nth-child\(/);
assert.match(main, /localStorage/);
assert.match(main, /LOCAL_TEST/);
assert.match(main, /TEST_SCENT = 999e33/);
assert.match(main, /LOCAL_TEST \|\| state\.scent >= price/);
assert.match(main, /if \(!LOCAL_TEST\) state\.scent -= price/);
assert.match(main, /state\.owned\[item\.id\] >= item\.max/);
assert.match(main, /"최대 보유"/);
assert.match(main, /offlineGain/);
assert.match(main, /sound\s*=\s*true/);
assert.match(main, /requestAnimationFrame/);
assert.match(main, /classList\.add\("reacting"\)/);
assert.match(main, /function purchaseEffect/);
assert.match(main, /function restorePile/);
assert.match(main, /stone\.style\.visibility = "hidden"/);
assert.match(
  main,
  /if \(stone\.isConnected\) stone\.style\.visibility = "visible"/,
);
assert.match(main, /stone\.style\.transform = `translate3d/);
assert.match(main, /function solveStoneCollision/);
assert.match(main, /Math\.abs\(dx\) >= minimum/);
assert.match(main, /function solveNearbyStoneCollisions/);
assert.match(main, /grid = new Map\(\)/);
assert.match(main, /solveNearbyStoneCollisions\(\)/);
assert.doesNotMatch(main, /for \(let j = i \+ 1/);
assert.match(main, /function updateStonePhysics/);
assert.match(main, /stonePhysicsActive = false/);
assert.match(main, /stoneSettledFrames >= 20/);
assert.match(main, /stonePhysicsClock >= 1 \/ 30/);
assert.match(main, /\$\("rate"\)\.textContent = compact\(rate\)/);
assert.match(main, /radius = size \* 0\.31/);
assert.match(main, /visibleLimit = mobile \? 24 : 70/);
assert.match(main, /matchMedia\("\(max-width: 520px\)"\)\.matches/);
assert.match(main, /const oldest = stoneBodies\.shift\(\)/);
assert.match(main, /oldest\?\.element\.remove\(\)/);
assert.match(main, /mobile \? 0\.75 : 0\.68/);
assert.match(main, /body\.supported = true/);
assert.match(main, /body\.spin \*= 0\.76/);
assert.match(main, /function showEasterEgg/);
assert.match(main, /Math\.random\(\) < 0\.028/);
assert.match(css, /@keyframes easter-shake/);
assert.match(css, /\.reaction-face/);
assert.match(css, /\.particles\s*\{[\s\S]*?z-index:\s*4/);
assert.match(css, /@keyframes blend-gather/);
assert.match(css, /@keyframes shelf-arrive/);
assert.match(css, /@keyframes facility-level-up/);
assert.match(css, /@keyframes cabinet-arrive/);
assert.match(css, /@keyframes product-place/);
assert.match(css, /@keyframes studio-open/);
assert.match(css, /@keyframes studio-spark/);
assert.match(css, /@keyframes studio-ambience/);
assert.match(css, /@keyframes master-burst/);
assert.match(css, /@keyframes master-dance/);
assert.match(css, /\.master-ending\[hidden\]/);
assert.match(css, /data-studio="5"/);
assert.doesNotMatch(css, /mix-blend-mode:\s*multiply/);
assert.doesNotMatch(
  css,
  /data-aging[^\n]*\.blend-table/,
  "숙성실 구매가 조합대를 강제로 표시하면 안 됩니다.",
);
assert.match(main, /1\.15 \+ Math\.random\(\) \* 1\.45/);
assert.match(main, /body\.spin \*= 0\.9995/);
assert.match(main, /collisionRadius: radius \* 0\.76/);
assert.match(main, /function restoreDropTimers/);
assert.match(main, /function emitProducedScents/);
assert.match(main, /effectLimit = matchMedia[\s\S]*\? 20 : 50/);
assert.match(main, /count = Math\.min\(timerLimit, state\.owned\.drop/);
assert.match(main, /"LV\.MAX"/);
assert.match(main, /blendCount >= 25 \? 3 : blendCount >= 10 \? 2/);
assert.match(main, /if \(document\.hidden\) return/);
assert.match(main, /dropTimers\[index\] = now \+ 5000/);
assert.match(main, /visibilitychange/);
assert.match(main, /restoreDropTimers\(last\)/);
assert.match(main, /function blendPurchaseEffect/);
assert.match(main, /function agingPurchaseEffect/);
assert.match(main, /function displayPurchaseEffect/);
assert.match(main, /function studioPurchaseEffect/);
assert.match(main, /function checkMasterCompletion/);
assert.match(main, /function masterFanfare/);
assert.match(main, /function shareMasterRecord/);
assert.match(main, /state\.masterCelebrated = true/);
assert.match(main, /facilities\.every/);
assert.match(main, /PUBLIC_WORKSHOP_URL/);
assert.match(main, /clickMultiplier\(state\.owned\)/);
assert.match(main, /studioCount >= 30/);
assert.match(main, /displayCount >= 50/);
assert.match(main, /function updateWorkshopStage/);
console.log(
  "PASS: scent workshop economy, mascot asset, offline reward, local save, and responsive shell.",
);
