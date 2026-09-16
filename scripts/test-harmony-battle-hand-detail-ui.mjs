import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createBattleHandDetailUi } from "../games/harmony/battle-hand-detail-ui.js";

const main = await readFile(new URL("../games/harmony/main.js", import.meta.url), "utf8"),
  styles = await readFile(new URL("../games/harmony/styles.css", import.meta.url), "utf8"),
  source = await readFile(
    new URL("../games/harmony/battle-hand-detail-ui.js", import.meta.url),
    "utf8",
  );

assert.match(main, /from "\.\/battle-hand-detail-ui\.js"/);
assert.match(main, /const battleHandDetailUi = createBattleHandDetailUi\(\);/);
assert.match(main, /function render\(\) \{\s*battleHandDetailUi\.hide\(\);/);
assert.match(main, /battleHandDetailUi\.bind\(\);/);
assert.doesNotMatch(main, /hideBattleHandDetailPanel\(\)/);
for (const name of [
  "hideBattleHandDetailPanel",
  "mountBattleHandDetailPanel",
  "positionBattleHandDetailPanel",
  "refreshBattleHandDetailPanel",
]) {
  assert.doesNotMatch(
    main,
    new RegExp(`function ${name}\\(`),
    `${name} implementation should live outside main.js`,
  );
}
assert.match(source, /battle-card-effect-tooltip-portal/);
const portalStart = styles.indexOf(".battle-card-effect-tooltip-portal {");
assert.notEqual(portalStart, -1, "The body portal needs a dedicated CSS block");
const portalEnd = styles.indexOf("}", portalStart);
const portalBlock = styles.slice(portalStart, portalEnd + 1);
for (const rule of [
  /visibility:\s*visible;/,
  /opacity:\s*1;/,
  /position:\s*fixed;/,
  /left:\s*var\(--battle-detail-left, 10px\);/,
  /transform:\s*none;/,
]) {
  assert.match(
    portalBlock,
    rule,
    "A body-portaled battle tooltip must carry its own visible fixed-position geometry",
  );
}
assert.doesNotMatch(
  styles,
  /top:\s*clamp\(76px, 12vh, 136px\)/,
  "The obsolete pre-portal fixed tooltip block should stay removed",
);

class FakeClassList {
  constructor() {
    this.values = new Set();
  }
  add(...values) {
    values.forEach((value) => this.values.add(value));
  }
  remove(...values) {
    values.forEach((value) => this.values.delete(value));
  }
  contains(value) {
    return this.values.has(value);
  }
}

class FakeStyle {
  constructor() {
    this.values = new Map();
  }
  setProperty(name, value) {
    this.values.set(name, value);
  }
  removeProperty(name) {
    this.values.delete(name);
  }
  getPropertyValue(name) {
    return this.values.get(name) || "";
  }
}

const listeners = new Map(),
  windowListeners = new Map(),
  tooltip = {
    classList: new FakeClassList(),
    style: new FakeStyle(),
    isConnected: true,
    scrollHeight: 120,
    before(placeholder) {
      placeholder.isConnected = true;
      placeholder.replaceWith = (node) => {
        placeholder.isConnected = false;
        node.isConnected = true;
        node.restored = true;
      };
    },
    remove() {
      this.isConnected = false;
    },
  },
  battle = {
    getBoundingClientRect: () => ({ width: 900 }),
  },
  hand = {
    getBoundingClientRect: () => ({ top: 500, bottom: 700 }),
  },
  card = {
    isConnected: true,
    hovered: true,
    querySelector: (selector) => (selector === ".card-effect-tooltip" ? tooltip : null),
    closest(selector) {
      if (selector === ".battle") return battle;
      if (selector === ".hand") return hand;
      if (selector === ".battle > .hand .card") return this;
      return null;
    },
    contains: (node) => node === card,
    matches(selector) {
      if (selector.includes(":hover")) return this.hovered;
      return false;
    },
    getBoundingClientRect: () => ({ left: 200, width: 200 }),
  },
  documentRef = {
    body: {
      append(node) {
        node.isConnected = true;
        node.portaled = true;
      },
    },
    createComment: () => ({ isConnected: false }),
    addEventListener(type, handler, options) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ handler, options });
    },
  },
  windowRef = {
    innerWidth: 1000,
    innerHeight: 800,
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(handler);
    },
  };

const ui = createBattleHandDetailUi({
  documentRef,
  windowRef,
  requestFrame: (callback) => callback(),
});
ui.position(card);
assert.equal(tooltip.portaled, true);
assert.equal(tooltip.classList.contains("battle-card-effect-tooltip-portal"), true);
assert.equal(tooltip.style.getPropertyValue("--battle-detail-left"), "85px");
assert.equal(tooltip.style.getPropertyValue("--battle-detail-width"), "430px");
assert.equal(tooltip.style.getPropertyValue("--battle-detail-max-height"), "210px");
assert.equal(tooltip.style.getPropertyValue("--battle-detail-top"), "370px");

ui.bind();
ui.bind();
assert.equal(listeners.get("pointerover")?.length, 1, "binding should be idempotent");
assert.equal(listeners.get("pointerout")?.length, 1);
assert.equal(listeners.get("focusin")?.length, 1);
assert.equal(listeners.get("focusout")?.length, 1);
assert.equal(windowListeners.get("resize")?.length, 1);
assert.equal(listeners.get("scroll")?.[0]?.options, true);

card.hovered = false;
ui.refresh();
assert.equal(tooltip.classList.contains("battle-card-effect-tooltip-portal"), false);
assert.equal(tooltip.style.getPropertyValue("--battle-detail-left"), "");
assert.equal(tooltip.style.getPropertyValue("--battle-detail-top"), "");
assert.equal(tooltip.restored, true);

console.log(
  "PASS Harmony battle hand detail UI keeps body-portaled tooltips visible, positioned, restored, and singly bound.",
);
