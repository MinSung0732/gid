import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";

const outDir = "/tmp/hand-flicker";
await fs.mkdir(outDir, { recursive: true });
const server = spawn(process.execPath, ["scripts/serve.cjs"], { stdio: ["ignore", "pipe", "pipe"] });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server timeout")), 10000);
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("127.0.0.1:5173")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once("exit", (code) => reject(new Error(`server exited ${code}`)));
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (msg) => console.log("PAGE", msg.type(), msg.text()));
  await page.goto("http://127.0.0.1:5173/games/harmony/?local=1", { waitUntil: "networkidle" });
  await page.locator('[data-action="test-new"]').click();
  await page.locator('[data-builder-action="preset"]').click();
  await page.locator('[data-builder-action="start"]').click();
  await page.waitForTimeout(250);
  const snapshot = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 5000),
    actions: [...document.querySelectorAll("[data-action]")].map((el) => ({
      tag: el.tagName,
      action: el.dataset.action,
      index: el.dataset.index ?? null,
      text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 120),
      disabled: "disabled" in el ? el.disabled : false,
    })),
    hand: [...document.querySelectorAll(".hand > .card")].map((el) => ({
      text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
      index: el.dataset.index ?? null,
      classes: el.className,
    })),
  }));
  console.log("SNAPSHOT", JSON.stringify(snapshot, null, 2));
  await page.screenshot({ path: `${outDir}/after-test-start.png`, fullPage: true });
  await browser.close();
} finally {
  server.kill("SIGTERM");
}
