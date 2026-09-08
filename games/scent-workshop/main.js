import {
  facilities,
  cost,
  perSecond,
  freshState,
  offlineGain,
  compact,
  clickMultiplier,
} from "./data.js";
const $ = (id) => document.getElementById(id),
  SAVE = "gyeolideun-scent-workshop-v1",
  LOCAL_TEST = ["localhost", "127.0.0.1", "::1"].includes(location.hostname),
  TEST_SCENT = 999e33;
let state = load(),
  sound = true,
  audio,
  last = performance.now(),
  saveClock = 0,
  reactionTimer,
  dropTimers = [],
  stoneBodies = [],
  hiddenAt = 0,
  stonePhysicsActive = false,
  stonePhysicsClock = 0,
  stoneSettledFrames = 0,
  stoneActiveFrames = 0,
  clickTimes = [],
  easterCooldown = 0,
  easterTimer,
  purchaseMessageTimer,
  masterTimer;
const PUBLIC_WORKSHOP_URL =
  "https://minsung0732.github.io/gid/games/scent-workshop/";
const easterLines = [
  "아야!",
  "그만해~",
  "간지러워!",
  "잠깐만!",
  "향기가 샜어!",
  "나도 쉬는 시간이 필요해…",
  "하트가 흔들리잖아!",
  "방금 몇 번째야?",
  "그래도 향기는 모아줄게!",
  "한 번만 살살 눌러줘",
  "목도리 풀리겠어!",
  "나무도 놀란다고!",
  "앗, 깜짝이야!",
  "열심히 하는 건 좋은데…",
  "향기가 가득해!",
  "오늘도 공방은 바쁘네",
  "혹시 클릭 장인이야?",
  "결이는 도망갈 수 없어…",
  "이번엔 봐줄게!",
  "제품도 한번 구경해 줘!",
];
function load() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(SAVE));
  } catch {}
  const base = freshState();
  if (!saved) return base;
  const loaded = {
    ...base,
    ...saved,
    owned: { ...base.owned, ...saved.owned },
  };
  facilities.forEach((item) => {
    loaded.owned[item.id] = Math.min(
      item.max,
      Math.max(0, Number(loaded.owned[item.id]) || 0),
    );
  });
  return loaded;
}
const save = () => {
  state.lastSeen = Date.now();
  try {
    localStorage.setItem(SAVE, JSON.stringify(state));
  } catch {}
};
function tone(type = "tap") {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    const o = audio.createOscillator(),
      g = audio.createGain(),
      now = audio.currentTime;
    o.type = type === "buy" ? "triangle" : "sine";
    o.frequency.setValueAtTime(type === "buy" ? 520 : 720, now);
    o.frequency.exponentialRampToValueAtTime(
      type === "buy" ? 760 : 850,
      now + 0.1,
    );
    g.gain.setValueAtTime(0.025, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(now + 0.17);
  } catch {}
}
function masterFanfare() {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    const now = audio.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = audio.createOscillator(),
        gain = audio.createGain(),
        start = now + index * 0.12;
      oscillator.type = index === 3 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.44);
    });
  } catch {}
}
function particle(amount) {
  const rect = $("gyeoli").getBoundingClientRect(),
    area = $("particles").getBoundingClientRect(),
    node = document.createElement("i");
  node.className = "float";
  node.style.left = `${rect.left - area.left + rect.width * (0.3 + Math.random() * 0.4)}px`;
  node.style.top = `${rect.top - area.top + 45 + Math.random() * 45}px`;
  node.style.setProperty("--x", `${(Math.random() - 0.5) * 100}px`);
  node.textContent = "";
  $("particles").append(node);
  const text = document.createElement("b");
  text.className = "float-number";
  text.textContent = `+${compact(amount)}`;
  node.append(text);
  setTimeout(() => node.remove(), 1100);
}
function render() {
  if (LOCAL_TEST) state.scent = TEST_SCENT;
  const rate = perSecond(state.owned);
  $("scent").textContent = compact(state.scent);
  $("rate").textContent = compact(rate);
  $("shop-rate").textContent = `${compact(rate)} 향기`;
  facilities.forEach((item) => {
    const button = document.querySelector(`[data-id="${item.id}"]`),
      price = cost(item, state.owned[item.id]),
      maxed = state.owned[item.id] >= item.max;
    button.disabled = maxed || (!LOCAL_TEST && state.scent < price);
    button.classList.toggle(
      "afford",
      !maxed && (LOCAL_TEST || state.scent >= price),
    );
    button.classList.toggle("maxed", maxed);
    button.querySelector(".cost").textContent = maxed
      ? "최대 보유"
      : compact(price);
    button.querySelector(".currency-label").hidden = maxed;
    button.querySelector(".owned").textContent = `보유 ${state.owned[item.id]}`;
  });
  updateWorkshopStage();
  checkMasterCompletion();
}
function isMasterComplete() {
  return facilities.every((item) => state.owned[item.id] >= item.max);
}
function fillMasterBurst() {
  const layer = $("master-burst"),
    colors = ["#235347", "#8eb69b", "#f8e29a", "#f38fa2", "#ffffff"];
  layer.replaceChildren();
  for (let index = 0; index < 42; index++) {
    const particle = document.createElement("i"),
      angle = (Math.PI * 2 * index) / 42 + (Math.random() - 0.5) * 0.25,
      distance = 110 + Math.random() * 230;
    particle.style.setProperty("--mx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--my", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--mc", colors[index % colors.length]);
    particle.style.setProperty("--md", `${Math.random() * 0.24}s`);
    layer.append(particle);
  }
}
function showMasterEnding(replay = false) {
  clearTimeout(masterTimer);
  if (replay) {
    fillMasterBurst();
    $("play-area").classList.remove("master-complete");
    void $("play-area").offsetWidth;
    $("play-area").classList.add("master-complete");
    $("gyeoli").classList.add("master-celebrate");
    masterFanfare();
    masterTimer = setTimeout(() => {
      $("master-ending").hidden = false;
      $("master-continue").focus();
      $("gyeoli").classList.remove("master-celebrate");
    }, 1050);
    return;
  }
  $("master-ending").hidden = false;
  $("master-continue").focus();
}
function checkMasterCompletion() {
  const complete = isMasterComplete();
  $("master-badge").hidden = !complete;
  if (!complete || state.masterCelebrated) return;
  state.masterCelebrated = true;
  save();
  showMasterEnding(true);
}
async function shareMasterRecord() {
  const text =
    "결이든 향기공방의 모든 오브제를 완성했어요!\n나도 향기 마스터에 도전하기 🌿";
  try {
    const value = `${text}\n${PUBLIC_WORKSHOP_URL}`;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      if (!copied) throw new Error("copy failed");
    }
    $("master-share-status").textContent =
      "기록과 게임 링크를 복사했어요. 원하는 앱에 붙여넣어 주세요.";
  } catch (error) {
    $("master-share-status").textContent =
      "링크를 복사하지 못했어요. 다시 시도해 주세요.";
  }
}
function buildShop() {
  $("facilities").innerHTML = facilities
    .map(
      (item) =>
        `<button class="facility" data-id="${item.id}" type="button">${item.asset ? `<img src="../../public/assets/${item.asset}" alt="">` : `<span class="facility-icon">${item.icon}</span>`}<span><strong>${item.name}</strong><small>${item.desc} · +${item.rate}/초</small></span><span class="price"><b><span class="cost"></span><span class="currency-label"> 향기</span></b><em class="owned"></em></span></button>`,
    )
    .join("");
  $("facilities").addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button) return;
    const item = facilities.find((value) => value.id === button.dataset.id),
      price = cost(item, state.owned[item.id]);
    if (
      state.owned[item.id] >= item.max ||
      (!LOCAL_TEST && state.scent < price)
    )
      return;
    if (!LOCAL_TEST) state.scent -= price;
    state.owned[item.id]++;
    purchaseEffect(item);
    tone("buy");
    save();
    render();
  });
}
const stoneAssets = {
  pink: "../../public/assets/scent-workshop/stone-pink.png",
  green: "../../public/assets/scent-workshop/stone-green.png",
  volcanic: "../../public/assets/scent-workshop/stone-volcanic.png",
};
function scentWisp() {
  const node = document.createElement("i"),
    colors = ["#9bc4d5", "#8eb69b", "#f38fa2", "#f8e29a"],
    layer = $("workshop-effects"),
    effectLimit = matchMedia("(max-width: 520px)").matches ? 20 : 50,
    visibleWisps = layer.querySelectorAll(".scent-wisp");
  if (visibleWisps.length >= effectLimit) visibleWisps[0].remove();
  node.className = "scent-wisp";
  node.style.setProperty(
    "--wisp",
    colors[Math.floor(Math.random() * colors.length)],
  );
  const angle = Math.random() * Math.PI * 2,
    distance = 190 + Math.random() * 130;
  node.style.setProperty("--wx", `${Math.cos(angle) * distance}px`);
  node.style.setProperty("--wy", `${Math.sin(angle) * distance - 50}px`);
  layer.append(node);
  setTimeout(() => node.remove(), 2700);
}
function addStone(type, animate = true) {
  const area = $("stone-pile").getBoundingClientRect(),
    mobile = matchMedia("(max-width: 520px)").matches,
    visibleLimit = mobile ? 24 : 70;
  if (stoneBodies.length >= visibleLimit) {
    if (!animate) return;
    const oldest = stoneBodies.shift();
    oldest?.element.remove();
    $("stone-pile").classList.remove("denser");
    void $("stone-pile").offsetWidth;
    $("stone-pile").classList.add("denser");
  }
  const stone = document.createElement("img"),
    index = stoneBodies.length,
    size = mobile
      ? 42 + Math.random() * 12
      : Math.max(52, Math.min(72, area.width * (0.13 + Math.random() * 0.035))),
    half = size / 2,
    radius = size * 0.31;
  stone.className = "pile-stone";
  stone.src = stoneAssets[type];
  stone.alt = "";
  stone.style.width = stone.style.height = `${size}px`;
  const pileWidth = area.width * (mobile ? 0.75 : 0.68),
    pileLeft = (area.width - pileWidth) / 2,
    columns = Math.max(3, Math.floor(pileWidth / (radius * 1.65))),
    x = animate
      ? pileLeft + half + Math.random() * Math.max(1, pileWidth - size)
      : pileLeft +
        half +
        (index % columns) * ((pileWidth - size) / Math.max(1, columns - 1)),
    y = animate
      ? -size
      : area.height - half - Math.floor(index / columns) * radius * 1.42,
    angle = (Math.random() - 0.5) * Math.PI;
  stone.style.visibility = "hidden";
  stone.style.transform = `translate3d(${x - half}px,${y - half}px,0) rotate(${angle}rad)`;
  $("stone-pile").append(stone);
  requestAnimationFrame(() => {
    if (stone.isConnected) stone.style.visibility = "visible";
  });
  stoneBodies.push({
    element: stone,
    x,
    y,
    vx: animate ? (Math.random() - 0.5) * 18 : 0,
    vy: 0,
    radius,
    half,
    collisionRadius: radius * 0.76,
    angle,
    spin: (Math.random() < 0.5 ? -1 : 1) * (1.15 + Math.random() * 1.45),
  });
  if (animate) {
    stonePhysicsActive = true;
    stoneSettledFrames = 0;
    stoneActiveFrames = 0;
  }
}
function solveStoneCollision(a, b) {
  let dx = b.x - a.x,
    dy = b.y - a.y,
    minimum = a.collisionRadius + b.collisionRadius;
  if (Math.abs(dx) >= minimum || Math.abs(dy) >= minimum) return;
  let distance = Math.hypot(dx, dy);
  if (distance >= minimum) return;
  if (distance < 0.01) {
    dx = 0.01;
    dy = 0;
    distance = 0.01;
  }
  const nx = dx / distance,
    ny = dy / distance,
    overlap = minimum - distance;
  if (ny > 0.28) a.supported = true;
  else if (ny < -0.28) b.supported = true;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;
  const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (relative < 0) {
    const impulse = -(1.12 * relative) / 2;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
  }
  const tangent = -ny * (b.vx - a.vx) + nx * (b.vy - a.vy);
  a.spin -= tangent * 0.002;
  b.spin += tangent * 0.002;
}
function solveNearbyStoneCollisions() {
  const cellSize = Math.max(
      36,
      ...stoneBodies.map((body) => body.collisionRadius * 2),
    ),
    grid = new Map();
  for (let index = 0; index < stoneBodies.length; index++) {
    const body = stoneBodies[index],
      cellX = Math.floor(body.x / cellSize),
      cellY = Math.floor(body.y / cellSize),
      key = `${cellX},${cellY}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(index);
  }
  for (let index = 0; index < stoneBodies.length; index++) {
    const body = stoneBodies[index],
      cellX = Math.floor(body.x / cellSize),
      cellY = Math.floor(body.y / cellSize);
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const nearby = grid.get(`${cellX + offsetX},${cellY + offsetY}`);
        if (!nearby) continue;
        for (const otherIndex of nearby) {
          if (otherIndex <= index) continue;
          solveStoneCollision(body, stoneBodies[otherIndex]);
        }
      }
    }
  }
}
function updateStonePhysics(dt) {
  if (!stoneBodies.length || !stonePhysicsActive) return;
  const area = $("stone-pile").getBoundingClientRect(),
    steps = Math.max(1, Math.ceil(dt / 0.016)),
    step = dt / steps;
  for (let pass = 0; pass < steps; pass++) {
    for (const body of stoneBodies) {
      body.supported = false;
      body.vy += 150 * step;
      body.x += body.vx * step;
      body.y += body.vy * step;
      body.angle += body.spin * step;
      if (body.x < body.half) {
        body.x = body.half;
        body.vx = Math.abs(body.vx) * 0.42;
        body.spin += 0.12;
      }
      if (body.x > area.width - body.half) {
        body.x = area.width - body.half;
        body.vx = -Math.abs(body.vx) * 0.42;
        body.spin -= 0.12;
      }
      if (body.y > area.height - body.half) {
        body.y = area.height - body.half;
        body.supported = true;
        body.vy = -Math.abs(body.vy) * 0.18;
        body.vx *= 0.9;
        body.spin *= 0.88;
        if (Math.abs(body.vy) < 3) body.vy = 0;
      }
    }
    for (let iteration = 0; iteration < 3; iteration++)
      solveNearbyStoneCollisions();
    for (const body of stoneBodies) {
      if (body.supported) {
        body.vx *= 0.88;
        body.spin *= 0.76;
        if (Math.abs(body.vx) < 0.25) body.vx = 0;
        if (Math.abs(body.vy) < 8) body.vy = 0;
        if (Math.abs(body.spin) < 0.012) body.spin = 0;
      } else {
        body.vx *= 0.997;
        body.spin *= 0.9995;
      }
    }
  }
  for (const body of stoneBodies) {
    body.element.style.zIndex = String(Math.round(body.y));
    body.element.style.transform = `translate3d(${body.x - body.half}px,${body.y - body.half}px,0) rotate(${body.angle}rad)`;
  }
  stoneActiveFrames++;
  const settled = stoneBodies.every(
    (body) =>
      body.supported &&
      Math.abs(body.vx) < 0.4 &&
      Math.abs(body.vy) < 8 &&
      Math.abs(body.spin) < 0.02,
  );
  stoneSettledFrames = settled ? stoneSettledFrames + 1 : 0;
  if (stoneSettledFrames >= 20 || stoneActiveFrames >= 360) {
    stonePhysicsActive = false;
    for (const body of stoneBodies) {
      body.vx = 0;
      body.vy = 0;
      body.spin = 0;
    }
  }
}
function purchaseEffect(item) {
  if (item.id === "drop") {
    scentWisp();
    const timerLimit = matchMedia("(max-width: 520px)").matches ? 20 : 50;
    if (dropTimers.length < timerLimit)
      dropTimers.push(performance.now() + 5000);
  } else if (stoneAssets[item.id]) addStone(item.id);
  else if (item.id === "blend") blendPurchaseEffect();
  else if (item.id === "aging") agingPurchaseEffect();
  else if (item.id === "display") displayPurchaseEffect();
  else if (item.id === "studio") studioPurchaseEffect();
}
function purchaseMessage(message) {
  const node = $("purchase-message");
  clearTimeout(purchaseMessageTimer);
  node.textContent = message;
  node.hidden = false;
  node.classList.remove("show");
  void node.offsetWidth;
  node.classList.add("show");
  purchaseMessageTimer = setTimeout(() => {
    node.hidden = true;
    node.classList.remove("show");
  }, 1800);
}
function blendPurchaseEffect() {
  const stage = $("workshop-stage");
  stage.classList.remove("blend-bought");
  void stage.offsetWidth;
  stage.classList.add("blend-bought");
  $("gyeoli").classList.add("crafting");
  setTimeout(() => $("gyeoli").classList.remove("crafting"), 1000);
  purchaseMessage("향기의 결이 하나로 모였어요");
}
function agingPurchaseEffect() {
  const stage = $("workshop-stage");
  stage.classList.remove("aging-bought");
  void stage.offsetWidth;
  stage.classList.add("aging-bought");
  purchaseMessage("향이 깊고 은은하게 익어가요");
}
function displayPurchaseEffect() {
  const stage = $("workshop-stage"),
    count = state.owned.display || 0;
  stage.classList.remove("display-bought");
  void stage.offsetWidth;
  stage.classList.add("display-bought");
  $("gyeoli").classList.add("admiring");
  setTimeout(() => $("gyeoli").classList.remove("admiring"), 1100);
  purchaseMessage(
    count === 1
      ? "첫 번째 오브제를 진열했어요"
      : count >= 50
        ? "결이든 진열장이 완성됐어요"
        : "진열장이 한층 더 빛나요",
  );
}
function studioPurchaseEffect() {
  const stage = $("workshop-stage"),
    count = state.owned.studio || 0,
    sparkLayer = stage.querySelector(".studio-sparks");
  stage.classList.remove("studio-bought");
  sparkLayer.replaceChildren();
  for (let index = 0; index < (count === 1 ? 18 : 10); index++) {
    const spark = document.createElement("i");
    spark.style.setProperty("--sx", `${(Math.random() - 0.5) * 240}px`);
    spark.style.setProperty("--sy", `${-35 - Math.random() * 105}px`);
    spark.style.setProperty("--delay", `${Math.random() * 0.22}s`);
    sparkLayer.append(spark);
  }
  void stage.offsetWidth;
  stage.classList.add("studio-bought");
  $("gyeoli").classList.add("admiring");
  setTimeout(() => $("gyeoli").classList.remove("admiring"), 1100);
  purchaseMessage(
    count === 1
      ? "결이든 공방이 문을 열었어요!"
      : count >= 30
        ? "결이든 공방이 완성됐어요!"
        : "공방에 따뜻한 향기와 불빛이 더해졌어요",
  );
}
function updateWorkshopStage() {
  const stage = $("workshop-stage"),
    blendCount = state.owned.blend || 0,
    blendLevel =
      blendCount >= 25 ? 3 : blendCount >= 10 ? 2 : blendCount >= 1 ? 1 : 0,
    agingCount = state.owned.aging || 0,
    agingLevel =
      agingCount >= 75 ? 3 : agingCount >= 25 ? 2 : agingCount >= 1 ? 1 : 0,
    displayCount = state.owned.display || 0,
    displayLevel =
      displayCount >= 50
        ? 5
        : displayCount >= 30
          ? 4
          : displayCount >= 15
            ? 3
            : displayCount >= 5
              ? 2
              : displayCount >= 1
                ? 1
                : 0,
    studioCount = state.owned.studio || 0,
    studioLevel =
      studioCount >= 30
        ? 5
        : studioCount >= 20
          ? 4
          : studioCount >= 10
            ? 3
            : studioCount >= 5
              ? 2
              : studioCount >= 1
                ? 1
                : 0;
  stage.dataset.blend = String(blendLevel);
  stage.dataset.aging = String(agingLevel);
  stage.dataset.display = String(displayLevel);
  stage.dataset.studio = String(studioLevel);
  const blendLabel = stage.querySelector(".blend-level"),
    agingLabel = stage.querySelector(".aging-level"),
    displayLabel = stage.querySelector(".display-level"),
    studioLabel = stage.querySelector(".studio-level");
  blendLabel.textContent = `조합 ${blendCount >= 100 ? "LV.MAX" : `LV.${blendCount}`}`;
  blendLabel.hidden = blendCount === 0;
  agingLabel.textContent = `숙성 ${agingCount >= 75 ? "LV.MAX" : `LV.${agingCount}`}`;
  agingLabel.hidden = agingCount === 0;
  displayLabel.textContent = `진열 ${displayCount >= 50 ? "LV.MAX" : `LV.${displayCount}`}`;
  displayLabel.hidden = displayCount === 0;
  studioLabel.textContent = `공방 ${studioCount >= 30 ? "LV.MAX" : `LV.${studioCount}`}`;
  studioLabel.hidden = studioCount === 0;
}
function restoreDropTimers(now = performance.now()) {
  const timerLimit = matchMedia("(max-width: 520px)").matches ? 20 : 50,
    count = Math.min(timerLimit, state.owned.drop || 0);
  dropTimers = Array.from(
    { length: count },
    (_, index) => now + ((index + 1) / Math.max(1, count)) * 5000,
  );
}
function emitProducedScents(now) {
  if (document.hidden) return;
  for (let index = 0; index < dropTimers.length; index++) {
    if (now < dropTimers[index]) continue;
    scentWisp();
    dropTimers[index] = now + 5000;
  }
}
function restorePile() {
  ["pink", "green", "volcanic"].forEach((type) => {
    const count = Math.min(40, state.owned[type] || 0);
    for (let index = 0; index < count; index++) addStone(type, false);
  });
}
function showEasterEgg(rapid = false) {
  const now = performance.now();
  if (now < easterCooldown) return;
  easterCooldown = now + 5000;
  const rapidLines = [
      "그만해~",
      "간지러워!",
      "하트가 흔들리잖아!",
      "방금 몇 번째야?",
    ],
    poses = rapid
      ? ["easter-shake", "easter-duck"]
      : ["easter-lean", "easter-duck", "easter-shake"],
    pose = poses[Math.floor(Math.random() * poses.length)],
    lines = rapid ? rapidLines : easterLines;
  clearTimeout(easterTimer);
  $("gyeoli").classList.remove("easter-shake", "easter-duck", "easter-lean");
  $("gyeoli").classList.add(pose);
  $("gyeoli-talk").textContent =
    lines[Math.floor(Math.random() * lines.length)];
  $("gyeoli-talk").hidden = false;
  easterTimer = setTimeout(() => {
    $("gyeoli").classList.remove(pose);
    $("gyeoli-talk").hidden = true;
  }, 1800);
}
$("gyeoli").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.repeat)
    event.preventDefault();
});
$("gyeoli").addEventListener("click", () => {
  const clickGain = state.clickPower * clickMultiplier(state.owned);
  state.scent += clickGain;
  state.total += clickGain;
  state.clicks = (state.clicks || 0) + 1;
  const clickNow = performance.now();
  clickTimes.push(clickNow);
  clickTimes = clickTimes.filter((time) => clickNow - time < 1100);
  if (clickTimes.length >= 9) showEasterEgg(true);
  else if (Math.random() < 0.028) showEasterEgg(false);
  particle(clickGain);
  clearTimeout(reactionTimer);
  $("gyeoli").classList.remove("reacting");
  void $("gyeoli").offsetWidth;
  $("gyeoli").classList.add("reacting");
  reactionTimer = setTimeout(
    () => $("gyeoli").classList.remove("reacting"),
    390,
  );
  tone();
  render();
});
$("sound").addEventListener("click", () => {
  sound = !sound;
  $("sound").textContent = sound ? "소리 켜짐" : "소리 꺼짐";
  $("sound").setAttribute("aria-pressed", String(sound));
  if (sound) tone("buy");
});
$("reset").addEventListener("click", () => {
  if (!confirm("공방의 모든 진행 기록을 초기화할까요?")) return;
  state = freshState();
  dropTimers = [];
  stoneBodies = [];
  $("stone-pile").replaceChildren();
  save();
  render();
});
$("master-badge").addEventListener("click", () => showMasterEnding(false));
$("master-continue").addEventListener("click", () => {
  $("master-ending").hidden = true;
  $("master-share-status").textContent = "";
});
$("master-share").addEventListener("click", shareMasterRecord);
buildShop();
restorePile();
restoreDropTimers();
const gain = offlineGain(state);
if (gain >= 1) {
  state.scent += gain;
  state.total += gain;
  $("offline").textContent = `쉬는 동안 향기 +${compact(gain)}`;
  $("offline").hidden = false;
  setTimeout(() => {
    $("offline").hidden = true;
  }, 4000);
}
render();
function frame(now) {
  if (document.hidden) {
    last = now;
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const gain = perSecond(state.owned) * dt;
  emitProducedScents(now);
  stonePhysicsClock += dt;
  if (stonePhysicsClock >= 1 / 30) {
    updateStonePhysics(Math.min(stonePhysicsClock, 1 / 15));
    stonePhysicsClock = 0;
  }
  if (gain) {
    state.scent += gain;
    state.total += gain;
  }
  saveClock += dt;
  if (saveClock >= 2) {
    save();
    saveClock = 0;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    save();
    return;
  }
  const now = Date.now(),
    seconds = hiddenAt
      ? Math.min(14400, Math.max(0, (now - hiddenAt) / 1000))
      : 0,
    gain = perSecond(state.owned) * seconds;
  if (gain) {
    state.scent += gain;
    state.total += gain;
  }
  hiddenAt = 0;
  last = performance.now();
  restoreDropTimers(last);
  save();
  render();
});
