import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:5173/games/harmony/";
const viewports = [
  ["1920x1080", 1920, 1080],
  ["1440x900", 1440, 900],
  ["narrow-pc", 960, 720],
  ["mobile", 390, 844],
];
const valueSets = [
  ["0", "0", "0막"],
  ["1", "100", "1막"],
  ["36", "15,177", "4막"],
  ["123,456,789", "9,876,543,210", "999막"],
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
    await page.waitForSelector(".lobby-record-panel");

    assert.deepEqual(
      await page.locator(".lobby-record-value").allTextContents(),
      ["0", "0", "0막"],
      name + ": clean profile zero presentation",
    );

    for (const values of valueSets) {
      const result = await page.evaluate((nextValues) => {
        const nodes = [...document.querySelectorAll(".lobby-record-value")];
        nodes.forEach((node, index) => { node.textContent = nextValues[index]; });
        return nodes.map((node) => ({
          scrollWidth: node.scrollWidth,
          parentClientWidth: node.parentElement.clientWidth,
        }));
      }, values);
      result.forEach((entry, index) => {
        assert.ok(
          entry.scrollWidth <= entry.parentClientWidth + 1,
          name + ": record value overflow: " + values[index],
        );
      });
    }

    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { top:r.top, bottom:r.bottom, width:r.width, height:r.height };
      };
      const stats = [...document.querySelectorAll(".lobby-record-stat")];
      const divider = getComputedStyle(stats[1], "::before");
      return {
        scrollWidth: document.documentElement.scrollWidth,
        hero: rect(".lobby-hero"),
        panel: rect(".lobby-record-panel"),
        features: rect(".lobby-features"),
        gridColumns: getComputedStyle(document.querySelector(".lobby-record-grid")).gridTemplateColumns,
        dividerWidth: divider.width,
        dividerHeight: divider.height,
        heading: document.querySelector("#lobby-record-heading")?.textContent,
        labels: [...document.querySelectorAll(".lobby-record-label")].map((el) => el.textContent),
        captions: [...document.querySelectorAll(".lobby-record-stat small")].map((el) => el.textContent),
      };
    });

    assert.ok(metrics.scrollWidth <= width + 1, name + ": no horizontal overflow");
    assert.equal(metrics.heading, "YOUR HARMONY RECORD");
    assert.deepEqual(metrics.labels, ["완료한 여정", "최고 점수", "최고 도달"]);
    assert.deepEqual(metrics.captions, ["JOURNEYS", "BEST SCORE", "DEEPEST RUN"]);
    assert.ok(metrics.panel.top >= metrics.hero.bottom - 2, name + ": panel follows hero");
    assert.ok(metrics.features.top >= metrics.panel.bottom - 2, name + ": features follow panel");
    if (width > 520) {
      assert.ok(metrics.gridColumns.split(" ").length >= 3, name + ": three-column record layout");
      assert.ok(metrics.panel.height >= 90 && metrics.panel.height <= 140, name + ": balanced panel height");
      assert.ok(parseFloat(metrics.dividerWidth) >= 1, name + ": vertical divider");
    } else {
      assert.equal(metrics.gridColumns.split(" ").length, 1, name + ": stacked mobile layout");
      assert.ok(parseFloat(metrics.dividerHeight) >= 1, name + ": horizontal mobile divider");
    }
    assert.deepEqual(pageErrors, [], name + ": no page errors");
    assert.deepEqual(consoleErrors, [], name + ": no console errors");
    console.log("POSTMERGE_RECORD_SMOKE", name, JSON.stringify(metrics));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log("PASS post-merge Harmony Lobby record panel smoke.");
