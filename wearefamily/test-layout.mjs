#!/usr/bin/env node
/**
 * Family-unit layout check for the deceased-only tree.
 * Walks the layout model and the rendered SVG connectors, and (optionally)
 * writes 390px screenshots of the tree and of person P058's card.
 *
 * Usage: node test-layout.mjs [--serve-dir DIR] [--port N] [--screenshots DIR]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}
const serveDir = path.resolve(opt("--serve-dir", path.dirname(new URL(import.meta.url).pathname)));
const shotDir = path.resolve(opt("--screenshots", serveDir));
const portWanted = Number(opt("--port", "0")) || 0;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function startServer(root, port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) {
      res.writeHead(403); res.end(); return;
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(err.code === "ENOENT" ? 404 : 500); res.end(); return; }
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function fail(msg) { throw new Error(msg); }
function almost(a, b, eps) { return Math.abs(a - b) <= (eps ?? 2); }
function larger(a, b) { return a > b ? a : b; }
function smaller(a, b) { return a < b ? a : b; }
function overlapsY(a1, a2, y) {
  const lo = smaller(a1, a2), hi = larger(a1, a2);
  return y >= lo - 2 && y <= hi + 2;
}

function assertLayoutModel(model, people, BW, BH) {
  const { pos, lines, families, gen } = model;
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const ids = people.map((p) => p.id);
  if (Object.keys(pos).length !== people.length) {
    fail("expected one box per person, got " + Object.keys(pos).length + " for " + people.length);
  }
  ids.forEach((id) => { if (!pos[id]) fail("missing position for " + id); });

  // Partners share a row and sit side by side with no one between them.
  const seen = new Set();
  people.forEach((p) => {
    if (!p.partner || !byId[p.partner]) return;
    const key = p.id < p.partner ? p.id + "|" + p.partner : p.partner + "|" + p.id;
    if (seen.has(key)) return;
    seen.add(key);
    const a = pos[p.id], b = pos[p.partner];
    if (Math.abs(a.y - b.y) > 1) fail("partners " + key + " are not on the same row");
    if (gen[p.id] !== gen[p.partner]) fail("partners " + key + " do not share a generation");
    const left = a.x < b.x ? p.id : p.partner;
    const right = left === p.id ? p.partner : p.id;
    const gap = pos[right].x - (pos[left].x + BW);
    if (gap < 8 || gap > 80) fail("partners " + key + " gap is " + gap + ", expected a short join");
    ids.forEach((other) => {
      if (other === left || other === right) return;
      if (Math.abs(pos[other].y - a.y) > 1) return;
      if (pos[other].x > pos[left].x && pos[other].x < pos[right].x) {
        fail("someone sits between partners " + key + ": " + other);
      }
    });
  });

  // A child is always exactly one row below each published parent.
  people.forEach((p) => {
    ["father", "mother"].forEach((k) => {
      const par = p[k];
      if (!par || !byId[par]) return;
      if (gen[p.id] !== gen[par] + 1) {
        fail(p.id + " generation " + gen[p.id] + " is not one below parent " + par + " at " + gen[par]);
      }
      if (Math.abs(pos[p.id].y - pos[par].y - (pos[p.id].y > 0 ? (Object.values(pos).find(() => false), 0) : 0)) < 0) return;
      const rowStep = pos[p.id].y - pos[par].y;
      if (rowStep < BH + 20) fail(p.id + " is not in a row below " + par);
    });
  });

  families.forEach((fam, i) => {
    const kids = fam.children;
    const wantParents = fam.parents.slice().sort().join("|");
    kids.forEach((kid) => {
      const person = byId[kid];
      const have = [person.father, person.mother].filter((id) => id && byId[id]).sort().join("|");
      if (have !== wantParents) {
        fail("family " + i + " attaches " + kid + " to " + wantParents + " but data says " + have);
      }
    });
  });

  // Each child with published parents belongs to exactly one family in the model.
  people.forEach((p) => {
    if (!p.father && !p.mother) return;
    if (!(p.father && byId[p.father]) && !(p.mother && byId[p.mother])) return;
    const hits = families.filter((f) => f.children.includes(p.id));
    if (hits.length !== 1) fail(p.id + " is in " + hits.length + " families, expected 1");
  });

  return true;
}

function assertSvgGeometry(model, people, BW, BH, svgLines) {
  const { pos, families } = model;
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const verts = svgLines.filter((l) => almost(l.x1, l.x2, 1.5) && !almost(l.y1, l.y2, 1.5));
  const horiz = svgLines.filter((l) => almost(l.y1, l.y2, 1.5) && !almost(l.x1, l.x2, 1.5));

  families.forEach((fam) => {
    const parents = fam.parents;
    const kids = fam.children;
    const key = (parents.slice().sort().join("|"));
    kids.forEach((kid) => {
      const top = pos[kid].y;
      const cx = pos[kid].x + BW / 2;
      const incoming = verts.filter((l) => {
        const bottom = larger(l.y1, l.y2);
        const topY = smaller(l.y1, l.y2);
        return almost(l.x1, cx, 2.5) && almost(bottom, top, 2.5) && topY < bottom - 4;
      });
      if (incoming.length !== 1) {
        fail("child " + kid + " has " + incoming.length + " verticals arriving at the box, expected 1");
      }
      const stem = incoming[0];
      const barY = smaller(stem.y1, stem.y2);
      let bar = horiz.filter((l) => almost(l.y1, barY, 2.5) && cx >= smaller(l.x1, l.x2) - 2.5 && cx <= larger(l.x1, l.x2) + 2.5);
      if (!bar.length) {
        // A single child centred under the parent mid has a very short bar.
        const shortBar = horiz.filter((l) => almost(l.y1, barY, 2.5) && almost((l.x1 + l.x2) / 2, cx, 6));
        if (!shortBar.length) fail("child " + kid + " stem does not meet a sibling bar");
        bar = shortBar;
      }
      // Every child whose stem meets this same bar must belong to this couple only.
      const midX = parents.reduce((s, id) => s + pos[id].x + BW / 2, 0) / parents.length;
      const parentTop = parents.length === 2 ? pos[parents[0]].y + BH / 2 : pos[parents[0]].y + BH;
      const drop = verts.filter((l) =>
        almost(l.x1, midX, 3) &&
        almost(larger(l.y1, l.y2), barY, 2.5) &&
        almost(smaller(l.y1, l.y2), parentTop, 4)
      );
      if (!drop.length) {
        fail("no drop from parents " + key + " to the sibling bar for " + kid);
      }

      // Any other child's stem on this bar must share the same parents.
      people.forEach((other) => {
        if (!pos[other.id] || other.id === kid) return;
        const ocx = pos[other.id].x + BW / 2;
        const otop = pos[other.id].y;
        const onBar = almost(otop, top, 40) && bar.some((l) =>
          ocx >= smaller(l.x1, l.x2) - 2.5 && ocx <= larger(l.x1, l.x2) + 2.5
        );
        if (!onBar) return;
        const oIn = verts.filter((l) => almost(l.x1, ocx, 2.5) && almost(larger(l.y1, l.y2), otop, 2.5) && almost(smaller(l.y1, l.y2), barY, 2.5));
        if (!oIn.length) return;
        const have = [other.father, other.mother].filter((id) => id && byId[id]).sort().join("|");
        const want = parents.slice().sort().join("|");
        if (have !== want) {
          fail("sibling bar for " + key + " also reaches " + other.id + " (parents " + have + ")");
        }
      });
    });
  });
}

async function loadPlaywright() {
  const candidates = [
    "playwright-core",
    "playwright",
    "/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.js",
  ];
  let last;
  for (const c of candidates) {
    try {
      return await import(c);
    } catch (err) { last = err; }
  }
  throw last || new Error("playwright-core not found");
}

const { server, port } = await startServer(serveDir, portWanted);
const url = "http://127.0.0.1:" + port + "/index.html";
const pw = await loadPlaywright();
const chromium = pw.chromium;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__wearefamily && window.__wearefamily.layoutData && document.querySelectorAll("[data-person]").length);
if (errors.length) fail("page error: " + errors.join("\n"));

const snapshot = await page.evaluate(() => {
  const wf = window.__wearefamily;
  const svgLines = [...document.querySelectorAll("#world line")].map((el) => ({
    x1: +el.getAttribute("x1"), y1: +el.getAttribute("y1"),
    x2: +el.getAttribute("x2"), y2: +el.getAttribute("y2"),
    kind: el.getAttribute("data-kind") || "",
    family: el.getAttribute("data-family") || "",
    child: el.getAttribute("data-child") || "",
  }));
  const boxes = [...document.querySelectorAll("[data-person]")].map((el) => el.getAttribute("data-person"));
  return {
    people: wf.people,
    BW: wf.BW,
    BH: wf.BH,
    layoutData: wf.layoutData,
    svgLines,
    boxes,
  };
});

const failures = [];
try {
  assertLayoutModel(snapshot.layoutData, snapshot.people, snapshot.BW, snapshot.BH);
  console.log("layout model: ok (" + snapshot.people.length + " people, " + snapshot.layoutData.families.length + " families)");
} catch (err) {
  console.error("layout model FAILED:", err.message);
  failures.push(err.message);
}
try {
  if (snapshot.boxes.length !== snapshot.people.length) {
    fail("SVG has " + snapshot.boxes.length + " person boxes, data has " + snapshot.people.length);
  }
  assertSvgGeometry(snapshot.layoutData, snapshot.people, snapshot.BW, snapshot.BH, snapshot.svgLines);
  console.log("SVG connectors: ok (" + snapshot.svgLines.length + " lines)");
} catch (err) {
  console.error("SVG connectors FAILED:", err.message);
  failures.push(err.message);
}

fs.mkdirSync(shotDir, { recursive: true });

// 390px mobile view of the whole tree (viewport after fitAll), not the records list.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(80);
const camInfo = await page.evaluate(() => {
  window.__wearefamily.fitAll(false);
  const r = document.getElementById("viewport").getBoundingClientRect();
  return { cam: { ...window.__wearefamily.cam }, vp: { w: r.width, h: r.height }, tree: { w: window.__wearefamily.layoutData.width, h: window.__wearefamily.layoutData.height } };
});
console.log("fitAll", JSON.stringify(camInfo));
const treePath = path.join(shotDir, "tree-mobile.png");
const vpEl = await page.$("#viewport");
await vpEl.screenshot({ path: treePath });
console.log("wrote " + treePath);

// Readable full-tree image at a scale where boxes can be inspected.
const scale = snapshot.layoutData.width > 3600 ? 0.45 : 0.6;
const inspectW = Math.ceil(snapshot.layoutData.width * scale + 32);
const inspectH = Math.ceil(snapshot.layoutData.height * scale + 32);
const inspectPath = path.join(shotDir, "tree-layout.png");
await page.evaluate((s) => {
  const wf = window.__wearefamily;
  const vp = document.getElementById("viewport");
  vp.style.height = Math.ceil(wf.layoutData.height * s + 24) + "px";
  vp.style.width = Math.ceil(wf.layoutData.width * s + 24) + "px";
  const world = document.getElementById("world");
  world.style.transition = "none";
  world.style.transformOrigin = "0 0";
  world.style.transform = "translate(12px, 12px) scale(" + s + ")";
}, scale);
await page.setViewportSize({ width: smaller(inspectW, 4000), height: smaller(inspectH + 80, 3000) });
await page.waitForTimeout(150);
const treeEl = await page.$("#viewport");
await treeEl.screenshot({ path: inspectPath });
console.log("wrote " + inspectPath);

// Fresh page at 390px with P058's card open.
const cardPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await cardPage.goto(url + "#p=P058", { waitUntil: "networkidle" });
await cardPage.waitForFunction(() => {
  const card = document.getElementById("card");
  return card && !card.hidden && card.classList.contains("open") && document.getElementById("card-title");
});
const title = await cardPage.$eval("#card-title", (el) => el.textContent);
if (!title) failures.push("P058 card opened without a title");
const cardPath = path.join(shotDir, "card-p058.png");
await cardPage.screenshot({ path: cardPath, fullPage: false });
console.log("wrote " + cardPath + " (title: " + title + ")");
await cardPage.close();

await browser.close();
server.close();

if (failures.length) {
  console.error("FAILED:\n" + failures.map((m) => " - " + m).join("\n"));
  process.exit(1);
}
console.log("all checks passed");
