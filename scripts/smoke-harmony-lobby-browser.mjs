import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5173/games/harmony/";
const viewports = [
  ["1920x1080", 1920, 1080],
  ["1440x900", 1440, 900],
  ["1280x720", 1280, 720],
  ["small-pc", 960, 720],
  ["mobile", 390, 844],
];

const browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    page.setDefaultTimeout(15000);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector(".lobby-hero", { timeout: 15000 });

    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
      };
      const hero = rect(".lobby-hero"),
        header = rect("header"),
        main = rect("main"),
        art = rect(".lobby-art-frame"),
        image = rect(".lobby-art-frame img"),
        record = rect(".lobby-record"),
        features = [...document.querySelectorAll(".lobby-features article")].map((el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height };
        }),
        primary = document.querySelector(".lobby-actions .lobby-action-primary"),
        local = document.querySelector(".lobby-action-tertiary");
      return {
        innerWidth,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        hero,
        header,
        main,
        art,
        image,
        record,
        features,
        primaryAction: primary?.dataset.action || null,
        localPresent: Boolean(local),
      };
    });

    assert.ok(metrics.hero && metrics.header && metrics.main && metrics.art && metrics.image && metrics.record);
    assert.ok(metrics.scrollWidth <= width + 1, name + ": no horizontal overflow");
    assert.ok(metrics.main.width <= 1300, name + ": main stays within requested launcher width");
    assert.ok(metrics.hero.top >= metrics.header.bottom - 2, name + ": hero must not collide with header");
    assert.ok(metrics.image.width > 0 && metrics.image.height > 0, name + ": artwork image must render");
    assert.ok(metrics.image.left >= metrics.art.left - 1 && metrics.image.right <= metrics.art.right + 1, name + ": artwork must stay inside its frame");
    assert.equal(metrics.primaryAction, "new", name + ": no-save lobby should prioritize new journey");
    assert.ok(metrics.localPresent, name + ": localhost should expose LOCAL tertiary action");
    assert.equal(metrics.features.length, 3, name + ": exactly three feature panels");
    if (width > 700) {
      const heights = metrics.features.map((entry) => entry.height);
      assert.ok(Math.max(...heights) - Math.min(...heights) < 3, name + ": feature panel heights should align");
      assert.ok(metrics.record.top >= metrics.hero.bottom - 3, name + ": record follows hero");
      assert.ok(metrics.features[0].top >= metrics.record.bottom - 3, name + ": features follow record");
    }
    console.log("SMOKE", name, JSON.stringify(metrics));

    if (name === "1440x900") {
      await page.click('[data-action="new"]');
      await page.waitForSelector("#starting-deck-builder[open]");
      await page.click("#builder-preset");
      await page.click("#builder-start");
      await page.waitForSelector(".play-layout");
      await page.click('[data-action="home"]');
      await page.waitForSelector(".lobby-hero");
      const active = await page.evaluate(() => ({
        first: document.querySelector(".lobby-actions button")?.dataset.action,
        primary: document.querySelector(".lobby-action-primary")?.dataset.action,
        secondary: document.querySelector(".lobby-action-secondary")?.dataset.action,
      }));
      assert.deepEqual(active, { first: "resume", primary: "resume", secondary: "new" }, "active run CTA hierarchy");
      await page.click('[data-action="new"]');
      await page.waitForSelector("#harmony-confirm[open]");
      await page.click("[data-harmony-confirm-cancel]");
      await page.waitForSelector("#harmony-confirm:not([open])");
      assert.equal(await page.locator('[data-action="resume"]').count(), 1, "cancelled new-run confirm preserves active run");
    }

    assert.deepEqual(pageErrors, [], name + ": no uncaught page errors");
    assert.deepEqual(consoleErrors, [], name + ": no console errors");
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("PASS Harmony Lobby Chromium viewport smoke.");
