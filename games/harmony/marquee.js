const MARQUEE_SELECTOR = "[data-marquee]";

let marqueeFrame = 0;
const observedMarquees = new WeakSet();

function measureMarquee(host) {
  if (!(host instanceof HTMLElement) || !host.isConnected) return;
  const track = host.querySelector(".ui-marquee-track");
  if (!(track instanceof HTMLElement)) return;

  host.classList.remove("is-overflowing");
  host.style.removeProperty("--marquee-shift");
  host.style.removeProperty("--marquee-duration");

  const hostWidth = Math.floor(host.getBoundingClientRect().width);
  const trackWidth = Math.ceil(track.scrollWidth);
  if (hostWidth <= 0 || trackWidth <= hostWidth + 2) return;

  const overflow = trackWidth - hostWidth;
  host.style.setProperty("--marquee-shift", `${overflow + 8}px`);
  host.style.setProperty(
    "--marquee-duration",
    `${Math.min(10, Math.max(5.8, 5 + overflow / 20)).toFixed(2)}s`,
  );
  host.classList.add("is-overflowing");
}

function refreshMarquees(root = document) {
  const hosts = [];
  if (root instanceof Element && root.matches(MARQUEE_SELECTOR)) hosts.push(root);
  root.querySelectorAll?.(MARQUEE_SELECTOR).forEach((host) => hosts.push(host));

  for (const host of hosts) {
    observeMarquee(host);
    measureMarquee(host);
  }
}

function scheduleMarqueeRefresh(root = document) {
  if (marqueeFrame) cancelAnimationFrame(marqueeFrame);
  marqueeFrame = requestAnimationFrame(() => {
    marqueeFrame = 0;
    refreshMarquees(root);
  });
}

const marqueeResizeObserver =
  typeof ResizeObserver === "function"
    ? new ResizeObserver((entries) => {
        for (const entry of entries) measureMarquee(entry.target);
      })
    : null;

function observeMarquee(host) {
  if (!marqueeResizeObserver || observedMarquees.has(host)) return;
  observedMarquees.add(host);
  marqueeResizeObserver.observe(host);
}

function startMarqueeObserver() {
  const app = document.getElementById("app");
  if (!app) return;

  refreshMarquees(app);

  const mutationObserver = new MutationObserver(() => scheduleMarqueeRefresh(app));
  mutationObserver.observe(app, { childList: true, subtree: true, characterData: true });

  window.addEventListener("resize", () => scheduleMarqueeRefresh(app), {
    passive: true,
  });

  document.fonts?.ready
    ?.then(() => scheduleMarqueeRefresh(app))
    .catch(() => {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMarqueeObserver, { once: true });
} else {
  startMarqueeObserver();
}
