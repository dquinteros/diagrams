#!/usr/bin/env node
// FPS benchmark runner: serves the production bench build, drives Chrome via
// CDP (no extra dependencies; uses Node's built-in WebSocket), measures pan &
// zoom FPS for every diagram type × size, and compares against baseline.json.
//
// Usage:
//   npm run bench                 # full matrix
//   node bench/run-fps.mjs dbml 300   # single config
// Env:
//   CHROME_BIN=/path/to/chrome    # override browser binary
//   BENCH_HEADLESS=1              # run headless (FPS less comparable)

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const benchDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(benchDir, "..");

const PORT = 5211;
const CDP_PORT = 9223;
const TYPES = ["dbml", "sequence", "bpmn", "architecture"];
const SIZES = [100, 300, 600, 1000];
const REGRESSION_TOLERANCE = 0.9; // fail if FPS < 90% of baseline

const [filterType, filterN] = process.argv.slice(2);

// The in-page measurement: waits for first render, then measures pan FPS
// (sinusoidal mousemove drag) and zoom FPS (alternating wheel events).
const MEASURE_FN = `async () => {
  await new Promise((resolve, reject) => {
    const t0 = performance.now();
    (function poll() {
      if (window.__BENCH__ && window.__BENCH__.renderMs != null) return resolve();
      if (performance.now() - t0 > 60000) return reject(new Error('render timeout'));
      requestAnimationFrame(poll);
    })();
  });
  const svg = document.querySelector('[data-diagram-svg]');
  const bg = svg.querySelector('.canvas-bg');
  const r = svg.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const mouse = (type, x, y, target) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1 }));
  const stats = (frames) => {
    const total = frames.reduce((a, b) => a + b, 0);
    const sorted = [...frames].sort((a, b) => a - b);
    const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    return {
      avgFps: +(1000 / (total / frames.length)).toFixed(1),
      frameP50: +p(0.5).toFixed(1),
      frameP95: +p(0.95).toFixed(1),
      frameMax: +Math.max(...frames).toFixed(1),
      droppedPct: +(100 * frames.filter((f) => f > 25).length / frames.length).toFixed(1),
    };
  };
  const measure = (action, durationMs) => new Promise((resolve) => {
    const frames = [];
    let last = null, start = null;
    const tick = (now) => {
      if (last != null) frames.push(now - last);
      last = now;
      if (start == null) start = now;
      if (now - start < durationMs) { action(now - start); requestAnimationFrame(tick); }
      else resolve(stats(frames));
    };
    requestAnimationFrame(tick);
  });
  await new Promise(r2 => setTimeout(r2, 300));
  mouse('mousedown', cx, cy, bg);
  await new Promise(r2 => requestAnimationFrame(r2));
  const pan = await measure((t) => {
    mouse('mousemove', cx + 180 * Math.sin(t / 250), cy + 120 * Math.cos(t / 330), svg);
  }, 2500);
  mouse('mouseup', cx, cy, svg);
  await new Promise(r2 => setTimeout(r2, 200));
  const zoom = await measure((t) => {
    const dir = Math.floor(t / 500) % 2 === 0 ? -1 : 1;
    svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: dir * 100 }));
  }, 2000);
  const mem = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null;
  return {
    type: window.__BENCH__.type, n: window.__BENCH__.n,
    renderMs: +window.__BENCH__.renderMs.toFixed(0),
    domTotal: document.querySelectorAll('*').length,
    svgEls: svg.querySelectorAll('*').length,
    heapMB: mem, pan, zoom,
  };
}`;

// ---------------------------------------------------------------- CDP client

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventHandlers = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      } else if (msg.method) {
        const hs = this.eventHandlers.get(msg.method);
        if (hs) hs.forEach((h) => h(msg.params));
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    if (!this.eventHandlers.has(method)) this.eventHandlers.set(method, new Set());
    this.eventHandlers.get(method).add(handler);
  }

  waitFor(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting ${method}`)), timeoutMs);
      const handler = (params) => {
        clearTimeout(timer);
        this.eventHandlers.get(method)?.delete(handler);
        resolve(params);
      };
      this.on(method, handler);
    });
  }
}

// ------------------------------------------------------------------- helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHttp(url, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error(`server at ${url} did not come up`);
}

function chromeBin() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

// ----------------------------------------------------------------------- run

async function main() {
  const configs = [];
  for (const type of TYPES) {
    if (filterType && type !== filterType) continue;
    for (const n of SIZES) {
      if (filterN && n !== Number(filterN)) continue;
      configs.push({ type, n });
    }
  }
  if (configs.length === 0) {
    console.error(`no configs match filter "${filterType} ${filterN ?? ""}"`);
    process.exit(2);
  }

  console.log("starting preview server...");
  const server = spawn(
    join(repoRoot, "node_modules/.bin/vite"),
    ["preview", "--config", "bench/vite.bench.config.ts", "--port", String(PORT), "--strictPort"],
    { cwd: repoRoot, stdio: "ignore" }
  );

  const profile = mkdtempSync(join(tmpdir(), "diagrams-bench-"));
  const headless = process.env.BENCH_HEADLESS === "1";
  console.log(`starting chrome (${headless ? "headless" : "headed"})...`);
  const chrome = spawn(
    chromeBin(),
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "--disable-extensions",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      "--window-size=1440,960",
      ...(headless ? ["--headless=new"] : []),
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const cleanup = () => {
    try { chrome.kill(); } catch { /* already gone */ }
    try { server.kill(); } catch { /* already gone */ }
  };
  process.on("SIGINT", () => { cleanup(); process.exit(130); });

  let failed = false;
  const results = [];
  try {
    await waitForHttp(`http://localhost:${PORT}/bench/bench.html`);
    await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`);

    const created = await fetch(
      `http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,
      { method: "PUT" }
    ).then((r) => r.json());
    const ws = new WebSocket(created.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const cdp = new Cdp(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    for (const { type, n } of configs) {
      const url = `http://localhost:${PORT}/bench/bench.html?type=${type}&n=${n}`;
      const loaded = cdp.waitFor("Page.loadEventFired");
      await cdp.send("Page.navigate", { url });
      await loaded;

      const evalRes = await cdp.send("Runtime.evaluate", {
        expression: `(${MEASURE_FN})()`,
        awaitPromise: true,
        returnByValue: true,
        timeout: 90000,
      });
      if (evalRes.exceptionDetails) {
        throw new Error(`${type}/${n}: ${evalRes.exceptionDetails.text} ${evalRes.result?.description ?? ""}`);
      }
      const r = evalRes.result.value;
      results.push(r);
      console.log(
        `${r.type.padEnd(13)} n=${String(r.n).padEnd(5)} pan=${String(r.pan.avgFps).padEnd(5)}fps ` +
          `zoom=${String(r.zoom.avgFps).padEnd(5)}fps render=${r.renderMs}ms heap=${r.heapMB}MB svg=${r.svgEls}`
      );
    }

    // Baseline comparison: fail if a config regresses >10% below baseline FPS.
    const baseline = JSON.parse(readFileSync(join(benchDir, "baseline.json"), "utf8"));
    console.log("\n--- vs baseline ---");
    for (const r of results) {
      const b = baseline.results.find((x) => x.type === r.type && x.n === r.n);
      if (!b) continue;
      const panOk = r.pan.avgFps >= b.pan.avgFps * REGRESSION_TOLERANCE;
      const zoomOk = r.zoom.avgFps >= b.zoom.avgFps * REGRESSION_TOLERANCE;
      const mark = panOk && zoomOk ? "ok " : "REG";
      if (!panOk || !zoomOk) failed = true;
      console.log(
        `${mark} ${r.type}/${r.n}: pan ${b.pan.avgFps} -> ${r.pan.avgFps} | zoom ${b.zoom.avgFps} -> ${r.zoom.avgFps}`
      );
    }

    writeFileSync(
      join(benchDir, "last-run.json"),
      JSON.stringify({ date: new Date().toISOString(), headless, results }, null, 2)
    );
    console.log(`\nresults written to bench/last-run.json`);
  } finally {
    cleanup();
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
