// D20 · Integration Test UI ↔ API (Sprint 1) · ระบบแจ้งซ่อมหอพัก CS261 กลุ่ม 3
// รันตามเอกสาร "Integration Test Design – UI ↔ API (Sprint 1)" ทุกเคส (IT-U2, IT-U3, IT-U1, IT-X)
// ใช้เบราว์เซอร์จริงเปิดหน้าเว็บที่ localhost:3000 แล้วตรวจทั้งหน้าจอและ request/response ที่วิ่งไป backend
//
// วิธีรัน (ระบบต้องรันอยู่ด้วย docker compose up --build):
//   cd tests/d20-ui-api
//   npm install
//   node run-d20.mjs              รันทุกเคส (IT-U1-10 จะสั่ง docker compose stop/start backend ให้เอง)
//   node run-d20.mjs --headed     เปิดหน้าต่างเบราว์เซอร์ให้ดูตอนรัน
//   node run-d20.mjs --skip-backend-stop   ข้าม IT-U1-10
// ผลอยู่ในโฟลเดอร์ results/ : d20-results.md, d20-results.json และรูปหลักฐานรายเคส IT-xx-xx.png

import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..", "..");
// ผลแต่ละรอบแยกโฟลเดอร์ตามเวลา (รอบก่อนแก้ / หลังแก้ จะได้เก็บไว้เทียบกันได้)
const RUN_STAMP = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
  .format(new Date()).replace(" ", "_").replace(":", "-");
const OUT = path.join(HERE, "results", RUN_STAMP);
const RAW = path.join(OUT, "raw");
const FIX = path.join(HERE, "results", "fixtures");

const UI = (process.env.UI_URL || "http://localhost:3000").replace(/\/$/, "");
const API = (process.env.API_URL || "http://localhost:8080").replace(/\/$/, "");
const ARGS = process.argv.slice(2);
const HEADED = ARGS.includes("--headed");
const SKIP_STOP = ARGS.includes("--skip-backend-stop");
const PASSWORD = "password123";

const STATUS_TH = { PENDING: "รอรับเรื่อง", IN_PROGRESS: "กำลังดำเนินการ", COMPLETED: "เสร็จสิ้น" };
const BASE = {
  building: "อาคาร A",
  location: "ชั้น 3 ห้อง 305",
  category: "ELECTRICAL",
  equipment: "ปลั๊กไฟหัวเตียงไม่มีไฟ",
  description: "ปลั๊กไฟข้างหัวเตียงเสียบอุปกรณ์แล้วไม่มีไฟ ลองหลายเครื่องแล้ว",
  phone: "081-234-5678",
};
const EXPECTED_KEYS = ["locationType", "building", "locationDetail", "category", "title", "description",
  "preferredDate1", "preferredSlot1", "contactPhone", "lineId", "urgency", "images"];

// ---------------------------------------------------------------- utils
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bangkokDate(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function thaiDate(iso) { // 2026-10-18 → 18/10/2569 (เหมือน formatDate ในหน้าเว็บ)
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
}
const TOMORROW = bangkokDate(1);
const DAY_AFTER = bangkokDate(2);

const isApi = (res, method, p) => {
  const u = new URL(res.url());
  return res.request().method() === method && u.origin === API && (typeof p === "string" ? u.pathname === p : p.test(u.pathname));
};

async function apiJson(method, p, { token, body } = {}) {
  const headers = { Origin: UI };
  if (token) headers.Authorization = "Bearer " + token;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  return { status: res.status, headers: res.headers, data };
}

async function waitBackend(timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(API + "/api/repair-requests/my");
      if (r.status === 401 || r.status === 200) return true;
    } catch { /* not up yet */ }
    await sleep(2000);
  }
  return false;
}

function docker(args) {
  const r = spawnSync("docker", ["compose", ...args], { cwd: PROJECT_ROOT, encoding: "utf8", timeout: 120000, shell: process.platform === "win32" });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim() };
}

// ---------------------------------------------------------------- browser
let browser;
let browserName = "";
async function launch() {
  const tries = process.env.PW_CHANNEL ? [process.env.PW_CHANNEL] : ["chrome", "msedge", null];
  for (const channel of tries) {
    try {
      browser = await chromium.launch({ channel: channel || undefined, headless: !HEADED, slowMo: HEADED ? 150 : 0 });
      browserName = `${channel || "chromium"} ${browser.version()}`;
      return;
    } catch { /* try next */ }
  }
  throw new Error("เปิดเบราว์เซอร์ไม่ได้: ต้องมี Google Chrome หรือ Microsoft Edge ในเครื่อง (หรือรัน npx playwright-core install chromium)");
}

// ---------------------------------------------------------------- fixtures
async function makeFixtures() {
  await fs.mkdir(FIX, { recursive: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent("<canvas id=c width=640 height=480></canvas>");
  const jpeg = async (label, color) => {
    const b64 = await page.evaluate(([label, color]) => {
      const c = document.getElementById("c");
      const g = c.getContext("2d");
      g.fillStyle = color; g.fillRect(0, 0, 640, 480);
      g.fillStyle = "#fff"; g.font = "bold 48px sans-serif"; g.fillText(label, 40, 120);
      g.font = "28px sans-serif"; g.fillText("รูปทดสอบ D20 · CS261 กลุ่ม 3", 40, 180);
      for (let i = 0; i < 40; i++) { g.fillStyle = `hsl(${i * 9},70%,60%)`; g.fillRect(40 + i * 14, 300, 10, 120); }
      return c.toDataURL("image/jpeg", 0.92).split(",")[1];
    }, [label, color]);
    return Buffer.from(b64, "base64");
  };
  const colors = ["#087f78", "#2563eb", "#b45309", "#9333ea"];
  for (let i = 1; i <= 4; i++) await fs.writeFile(path.join(FIX, `ok${i}.jpg`), await jpeg(`ok${i}.jpg`, colors[i - 1]));
  // mid.jpg ≈ 3 MB และ big.jpg > 5 MB: รูป jpg จริงแล้วต่อข้อมูลท้ายไฟล์ให้ได้ขนาดตามที่ต้องการ (เบราว์เซอร์ยังเปิดได้ปกติ)
  const pad = (buf, size) => Buffer.concat([buf, Buffer.alloc(size - buf.length, 0)]);
  await fs.writeFile(path.join(FIX, "mid.jpg"), pad(await jpeg("mid.jpg 3MB", "#0f766e"), 3 * 1024 * 1024));
  await fs.writeFile(path.join(FIX, "big.jpg"), pad(await jpeg("big.jpg 5.5MB", "#b91c1c"), Math.round(5.5 * 1024 * 1024)));
  await fs.writeFile(path.join(FIX, "doc.pdf"), "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  await ctx.close();
}
const fx = (name) => path.join(FIX, name);

// ---------------------------------------------------------------- case runner
const results = [];
const state = {};
let activeRec = null;

// เบราว์เซอร์ไม่เปิดให้อ่าน body ของ request ที่มีไฟล์แนบ จึงบันทึก FormData ที่ JS ส่งให้ fetch แทน
// (เรียก fetch ตัวจริงต่อด้วยค่าเดิมทุกอย่าง ไม่เปลี่ยนสิ่งที่ส่งไป backend)
const RECORD_FORMDATA = () => {
  const orig = window.fetch;
  window.fetch = function (input, init) {
    try {
      if (init && init.body instanceof FormData) {
        const fields = {};
        const files = [];
        for (const [k, v] of init.body.entries()) {
          if (v instanceof File) files.push({ field: k, filename: v.name, type: v.type, size: v.size });
          else fields[k] = v;
        }
        window.__d20Form(JSON.stringify({ url: String(input), method: init.method || "GET", fields, files }));
      }
    } catch (e) { /* ไม่ให้กระทบหน้าเว็บ */ }
    const p = orig.apply(this, arguments);
    // เก็บ JSON ที่ตอบกลับไว้ก่อนหน้าเว็บเปลี่ยนหน้า (หลังเปลี่ยนหน้าแล้วเบราว์เซอร์ทิ้ง body ไป)
    p.then((r) => {
      if (!(r.headers.get("content-type") || "").includes("json")) return;
      r.clone().json().then((j) => window.__d20Resp(JSON.stringify({ url: r.url, status: r.status, json: j }))).catch(() => {});
    }).catch(() => {});
    return p;
  };
};

async function newSession() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "th-TH", timezoneId: "Asia/Bangkok" });
  await ctx.exposeFunction("__d20Form", (json) => { try { activeRec?.forms.push(JSON.parse(json)); } catch { /* ignore */ } });
  await ctx.exposeFunction("__d20Resp", (json) => { try { activeRec?.bodies.push(JSON.parse(json)); } catch { /* ignore */ } });
  await ctx.addInitScript(RECORD_FORMDATA);
  const page = await ctx.newPage();
  return { ctx, page };
}

function formOf(rec, n = -1) {
  const f = rec.forms.at(n);
  if (!f) return null;
  return { ...f, bytes: f.files.reduce((s, x) => s + x.size, 0) };
}

/** หลังกดส่งสำเร็จ หน้าเว็บพาไป repair-success.html?id=N อ่าน N แล้วดึงคำร้องจาก API ด้วย token ของผู้ใช้คนเดิม */
async function createdFromSuccess(page) {
  await page.waitForURL(/repair-success\.html\?id=\d+/, { timeout: 15000 });
  const id = Number(new URL(page.url()).searchParams.get("id"));
  const token = await page.evaluate(() => localStorage.getItem("token"));
  const d = await apiJson("GET", `/api/repair-requests/${id}`, { token });
  return { id, data: d.data || {} };
}

function attach(page, rec) {
  const map = new Map();
  const onReq = (req) => {
    if (!req.url().startsWith(API)) return;
    const u = new URL(req.url());
    const entry = { method: req.method(), path: u.pathname + u.search, auth: req.headers()["authorization"] || "", headers: req.headers(), status: null, failed: null };
    if (req.method() === "POST") {
      const ct = req.headers()["content-type"] || "";
      if (ct.includes("multipart")) entry.multipart = true;
      else entry.body = req.postData();
    }
    map.set(req, entry);
    rec.requests.push(entry);
  };
  const onRes = async (res) => {
    const e = map.get(res.request());
    if (!e) return;
    e.status = res.status();
    e.acao = res.headers()["access-control-allow-origin"] || "";
    if ((res.headers()["content-type"] || "").includes("json")) {
      try { e.json = await res.json(); } catch { /* ignore */ }
    }
  };
  const onFail = (req) => { const e = map.get(req); if (e) e.failed = req.failure()?.errorText || "failed"; };
  const onConsole = (msg) => {
    if (msg.type() !== "error") return;
    const src = msg.location()?.url || "";
    if (/favicon/i.test(msg.text() + src)) return;
    // ฟอนต์จาก Google Fonts ฯลฯ โหลดไม่ได้ (เช่นเครื่องไม่มีเน็ต) ไม่เกี่ยวกับ UI ↔ API
    if (src && !src.startsWith(UI) && !src.startsWith(API)) return;
    rec.console.push(msg.text());
  };
  const onPageErr = (err) => rec.console.push("pageerror: " + err.message);
  const onDialog = async (d) => { rec.dialogs.push(d.message()); await d.accept(); };
  page.on("request", onReq); page.on("response", onRes); page.on("requestfailed", onFail);
  page.on("console", onConsole); page.on("pageerror", onPageErr); page.on("dialog", onDialog);
  return () => {
    page.off("request", onReq); page.off("response", onRes); page.off("requestfailed", onFail);
    page.off("console", onConsole); page.off("pageerror", onPageErr); page.off("dialog", onDialog);
  };
}

async function runCase(id, title, fn, { session, keep = false } = {}) {
  const rec = { id, title, status: "fail", checks: [], notes: [], actual: [], requests: [], forms: [], bodies: [], console: [], dialogs: [], error: null };
  const s = session || (await newSession());
  activeRec = rec;
  const detach = attach(s.page, rec);
  const t = {
    page: s.page, ctx: s.ctx, rec,
    check: (name, ok, detail = "") => rec.checks.push({ name, ok: !!ok, detail: String(detail ?? "") }),
    note: (text) => rec.notes.push(text),
    actual: (text) => rec.actual.push(text),
    skip: (reason) => { rec.skipped = reason; },
  };
  try {
    await fn(t);
  } catch (e) {
    rec.error = e.message.split("\n")[0];
  }
  await sleep(250);
  detach();
  activeRec = null;
  if (rec.skipped) rec.status = "skip";
  else rec.status = !rec.error && rec.checks.length && rec.checks.every((c) => c.ok) ? "pass" : "fail";
  try { await evidence(s.page, rec); } catch (e) { rec.notes.push("แคปหน้าจอไม่สำเร็จ: " + e.message); }
  if (!keep) await s.ctx.close();
  results.push(rec);
  const mark = { pass: "✓ ผ่าน    ", fail: "✗ ไม่ผ่าน ", skip: "– รันไม่ได้" }[rec.status];
  const why = rec.status === "fail" ? "  ← " + (rec.error || rec.checks.find((c) => !c.ok)?.name || "") : rec.status === "skip" ? "  ← " + rec.skipped : "";
  console.log(`${mark} ${id}  ${title}${why}`);
  return s;
}

// ---------------------------------------------------------------- page helpers
async function text(page, sel) {
  const loc = page.locator(sel).first();
  if (!(await loc.count())) return null;
  return (await loc.innerText()).trim();
}
async function shown(page, sel) {
  const loc = page.locator(sel).first();
  return (await loc.count()) ? loc.isVisible() : false;
}
async function displayOf(page, sel) {
  return page.$eval(sel, (el) => getComputedStyle(el).display).catch(() => "ไม่พบ element");
}

async function loginUI(page, username, password = PASSWORD) {
  await page.goto(UI + "/pages/login.html");
  await page.fill("#username", username);
  await page.fill("#password", password);
  const [res] = await Promise.all([
    page.waitForResponse((r) => isApi(r, "POST", "/api/auth/login"), { timeout: 15000 }),
    page.click("#login-btn"),
  ]);
  return res;
}
async function loginAndGo(page, username, pagePath, apiPath) {
  const res = await loginUI(page, username);
  if (res.status() !== 200) throw new Error(`login ${username} ไม่สำเร็จ (${res.status()})`);
  await page.waitForURL(/home\.html/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  if (!pagePath) return null;
  const [r] = await Promise.all([
    apiPath ? page.waitForResponse((x) => isApi(x, "GET", apiPath), { timeout: 15000 }) : Promise.resolve(null),
    page.goto(UI + pagePath),
  ]);
  return r;
}

async function fillBaseline(page, { common = false, images = ["ok1.jpg"], second = false, lineId = "" } = {}) {
  await page.check(common ? "#area-common" : "#area-room");
  await page.selectOption("#building", BASE.building);
  await page.fill("#location", BASE.location);
  await page.selectOption("#category", BASE.category);
  await page.fill("#equipment", BASE.equipment);
  await page.fill("#description", BASE.description);
  await page.fill("#preferred-date-1", TOMORROW);
  await page.selectOption("#preferred-time-1", "MORNING");
  if (second) {
    await page.fill("#preferred-date-2", DAY_AFTER);
    await page.selectOption("#preferred-time-2", "AFTERNOON");
  }
  await page.fill("#phone", BASE.phone);
  if (lineId) await page.fill("#line-id", lineId);
  if (images.length) await page.setInputFiles("#images", images.map(fx));
}
async function openForm(page) {
  await loginAndGo(page, "resident01", null);
  await page.goto(UI + "/pages/repair-form.html");
  await page.waitForSelector("#repair-form");
}
async function submitAndWait(page) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => isApi(r, "POST", "/api/repair-requests"), { timeout: 20000 }),
    page.click("#submit-btn"),
  ]);
  return res;
}
const posts = (rec) => rec.requests.filter((r) => r.method === "POST" && r.path.startsWith("/api/repair-requests"));

async function checkNoPostAndMessage(t, expectText, label) {
  const { page, check, actual, rec } = t;
  await sleep(400);
  const msg = (await text(page, "#images-error")) || "";
  const vis = await shown(page, "#images-error");
  check("ไม่มี POST ไป backend (หน้าเว็บกันไว้)", posts(rec).length === 0, `POST ${posts(rec).length} ครั้ง`);
  check(`#images-error เป็นข้อความเรื่อง${label}`, msg.includes(expectText), `"${msg}"`);
  check("ผู้ใช้มองเห็นข้อความเตือนบนหน้าจอ", vis, vis ? "" : `ข้อความถูกซ่อนอยู่ (display: ${await displayOf(page, "#images-error")})`);
  actual(`ไม่มี request · #images-error = "${msg}" · ${vis ? "มองเห็นบนหน้าจอ" : "มองไม่เห็นบนหน้าจอ (CSS ซ่อน)"}`);
  // ลองกดส่งต่อเหมือนผู้ใช้ไม่สนใจคำเตือน
  await page.click("#submit-btn");
  await sleep(600);
  check("กดส่งแล้วก็ยังไม่มี POST", posts(rec).length === 0, `POST ${posts(rec).length} ครั้ง`);
}

// ---------------------------------------------------------------- evidence image
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

async function evidence(page, rec) {
  await fs.mkdir(RAW, { recursive: true });
  const rawPath = path.join(RAW, `${rec.id}-page.png`);
  let shot = null;
  if (!page.isClosed() && page.url() !== "about:blank") {
    shot = await page.screenshot({ path: rawPath, fullPage: true });
  }
  let formIdx = 0;
  const reqRows = rec.requests.map((r) => {
    let info = "";
    if (r.multipart) {
      const f = formOf(rec, formIdx++);
      info = f ? `FormData: ${Object.keys(f.fields).join(", ")} · images ${f.files.length} ไฟล์ (${(f.bytes / 1048576).toFixed(2)} MB)` : "multipart/form-data";
    }
    else if (r.body) info = esc(r.body).slice(0, 120);
    const json = r.json ?? rec.bodies.find((b) => b.url.endsWith(r.path) && b.status === r.status)?.json;
    if (json && typeof json === "object") {
      const j = Array.isArray(json) ? `[${json.length} รายการ]` : JSON.stringify({ ...json, token: json.token ? "…" : undefined }).slice(0, 160);
      info += (info ? "<br>" : "") + "→ " + esc(j);
    }
    const st = r.failed ? `<b class=bad>failed</b>` : r.status == null ? "-" : `<b class=${r.status < 400 ? "good" : "warn"}>${r.status}</b>`;
    return `<tr><td>${r.method}</td><td class=mono>${esc(r.path)}</td><td>${st}</td><td>${r.auth ? "Bearer ✓" : "–"}</td><td class=small>${info}</td></tr>`;
  }).join("");
  const checks = rec.checks.map((c) => `<li class=${c.ok ? "good" : "bad"}>${c.ok ? "✓" : "✗"} ${esc(c.name)}${c.detail ? ` <span class=small>— ${esc(c.detail)}</span>` : ""}</li>`).join("");
  const label = { pass: "ผ่าน", fail: "ไม่ผ่าน", skip: "รันไม่ได้" }[rec.status];
  const html = `<!doctype html><meta charset=utf-8><style>
    body{margin:0;font-family:Sarabun,"Leelawadee UI",Tahoma,sans-serif;background:#f3f5f7;color:#16202a}
    .wrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;padding:16px;width:1700px;box-sizing:border-box}
    .shot{background:#fff;border:1px solid #d0d7de;border-radius:8px;overflow:hidden}.shot img{width:100%;display:block}
    .panel{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:14px 16px}
    h1{font-size:22px;margin:0 0 4px}.tag{display:inline-block;padding:2px 10px;border-radius:99px;font-size:14px;color:#fff}
    .pass{background:#15803d}.fail{background:#b91c1c}.skip{background:#6b7280}
    h2{font-size:15px;margin:14px 0 6px;color:#475569}table{border-collapse:collapse;width:100%;font-size:13px}
    td,th{border-bottom:1px solid #e5e7eb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f8fafc}
    .mono{font-family:Consolas,monospace}.small{font-size:12px;color:#475569}ul{margin:0;padding-left:0;list-style:none;font-size:14px}
    li{margin:3px 0}.good{color:#15803d}.bad{color:#b91c1c}.warn{color:#b45309}.meta{font-size:12px;color:#64748b}
  </style><div class=wrap><div class=shot>${shot ? `<img src="data:image/png;base64,${shot.toString("base64")}">` : "<p style='padding:16px'>ไม่มีภาพหน้าเว็บ (เคสนี้ตรวจผ่าน API โดยตรง)</p>"}</div>
  <div class=panel><h1>${esc(rec.id)} <span class="tag ${rec.status}">${label}</span></h1><div>${esc(rec.title)}</div>
  <div class=meta>${esc(new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }))} · ${esc(browserName)} · URL ${esc(page.isClosed() ? "" : page.url())}</div>
  <h2>Network → backend (${esc(API)})</h2><table><tr><th>Method</th><th>Path</th><th>Status</th><th>Auth</th><th>รายละเอียด</th></tr>${reqRows || "<tr><td colspan=5>ไม่มี request</td></tr>"}</table>
  ${rec.dialogs.length ? `<h2>กล่องข้อความ (alert)</h2><ul>${rec.dialogs.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
  <h2>ผลการตรวจ</h2><ul>${checks}${rec.error ? `<li class=bad>✗ error: ${esc(rec.error)}</li>` : ""}</ul>
  ${rec.notes.length ? `<h2>หมายเหตุ</h2><ul>${rec.notes.map((n) => `<li>• ${esc(n)}</li>`).join("")}</ul>` : ""}
  ${rec.console.length ? `<h2>Console error</h2><ul class=small>${rec.console.slice(0, 6).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
  </div></div>`;
  const ctx = await browser.newContext({ viewport: { width: 1700, height: 900 } });
  const p = await ctx.newPage();
  await p.setContent(html);
  await p.screenshot({ path: path.join(OUT, `${rec.id}.png`), fullPage: true });
  await ctx.close();
}

// ================================================================ CASES
async function u2Cases() {
  await runCase("IT-U2-01", "login สำเร็จด้วย resident01", async ({ page, check, actual, note, rec }) => {
    const res = await loginUI(page, "resident01");
    const req = res.request();
    let body = {};
    try { body = JSON.parse(req.postData() || "{}"); } catch { /* ignore */ }
    check("ส่ง POST /api/auth/login แบบ JSON พร้อม username/password ที่กรอก",
      (req.headers()["content-type"] || "").includes("application/json") && body.username === "resident01" && body.password === PASSWORD);
    await page.waitForURL(/home\.html/, { timeout: 10000 }).catch(() => {});
    const data = rec.bodies.find((b) => b.url.endsWith("/api/auth/login"))?.json || {};
    check("ได้ 200", res.status() === 200, res.status());
    check("response มี token, userId 1, fullName, role RESIDENT", data.token && data.userId === 1 && data.fullName && data.role === "RESIDENT", JSON.stringify({ ...data, token: data.token ? "…" : undefined }));
    check("response มี roomNumber ตาม API spec", Object.prototype.hasOwnProperty.call(data, "roomNumber"), `field ที่ได้: ${Object.keys(data).join(", ")}`);
    await page.waitForURL(/home\.html/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    const token = await page.evaluate(() => localStorage.getItem("token"));
    check("Local Storage มี token", !!token);
    const name = await text(page, "#user-name");
    const room = await text(page, "#user-room");
    check('#user-name แสดง "สมชาย ใจดี"', name === "สมชาย ใจดี", name);
    check('#user-room แสดง "A-305"', room === "A-305", room);
    if (!("roomNumber" in data)) note("A-305 ที่เห็นเป็นข้อความตายตัวใน home.html ไม่ได้มาจาก API ผู้ใช้ทุกคนจึงเห็น A-305 เหมือนกัน (ดู IT-X-02)");
    actual(`${res.status()} ได้ ${Object.keys(data).join(", ")} · ไป home.html · ชื่อ "${name}" · ห้อง "${room}"`);
  });

  for (const [id, user, pass, label] of [
    ["IT-U2-02", "resident01", "wrong123", "รหัสผ่านผิด"],
    ["IT-U2-03", "nobody", PASSWORD, "ไม่มีผู้ใช้นี้"],
  ]) {
    await runCase(id, `login ไม่สำเร็จ (${label})`, async ({ page, check, actual }) => {
      const res = await loginUI(page, user, pass);
      await sleep(400);
      const msg = (await text(page, "#login-error")) || "";
      const vis = await shown(page, "#login-error");
      const token = await page.evaluate(() => localStorage.getItem("token"));
      check("ได้ 401", res.status() === 401, res.status());
      check('#login-error เป็น "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"', msg === "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", `"${msg}"`);
      check("ผู้ใช้มองเห็นข้อความเตือนบนหน้าจอ", vis, vis ? "" : `ข้อความถูกซ่อนอยู่ (display: ${await displayOf(page, "#login-error")})`);
      check("ยังอยู่หน้า login", page.url().includes("login.html"), page.url());
      check("ไม่มี token ใน Local Storage", !token);
      actual(`${res.status()} · #login-error = "${msg}" · ${vis ? "มองเห็นบนหน้าจอ" : "มองไม่เห็นบนหน้าจอ (CSS ซ่อน)"} · อยู่หน้าเดิม`);
    });
  }

  await runCase("IT-U2-04", "เว้น username ว่างแล้วกดเข้าสู่ระบบ", async ({ page, check, actual, note, rec }) => {
    await page.goto(UI + "/pages/login.html");
    await page.fill("#username", "");
    await page.fill("#password", PASSWORD);
    await page.click("#login-btn");
    await sleep(800);
    const sent = rec.requests.filter((r) => r.path === "/api/auth/login").length;
    const native = await page.$eval("#username", (el) => el.validationMessage);
    const vis = await shown(page, "#login-error");
    check("ไม่มี request ไป /api/auth/login", sent === 0, `${sent} ครั้ง`);
    check("มีคำเตือนให้กรอกให้ครบ", vis || !!native, native ? `เบราว์เซอร์เตือน: "${native}"` : "");
    if (native && !vis) note('คำเตือนมาจากเบราว์เซอร์ (attribute required ใน login.html) ไม่ใช่ #login-error ตามที่ออกแบบไว้ ผลลัพธ์ที่ผู้ใช้ได้เหมือนกันคือกรอกไม่ครบแล้วส่งไม่ได้');
    actual(`ไม่มี request · ${native ? `เบราว์เซอร์เตือน "${native}"` : vis ? "#login-error เตือน" : "ไม่มีคำเตือน"}`);
  });

  const s = await runCase("IT-U2-05", "ออกจากระบบจากหน้าโฮม", async ({ page, check, actual }) => {
    await loginAndGo(page, "resident01", null);
    const token = await page.evaluate(() => localStorage.getItem("token"));
    const [res] = await Promise.all([
      page.waitForResponse((r) => isApi(r, "POST", "/api/auth/logout"), { timeout: 10000 }),
      page.click("#logout-btn"),
    ]);
    const auth = res.request().headers()["authorization"] || "";
    check("ส่ง POST /api/auth/logout พร้อม Authorization: Bearer <token>", auth === "Bearer " + token, auth ? "Bearer …" : "ไม่มี header");
    check("ได้ 200", res.status() === 200, res.status());
    await page.waitForURL(/login\.html/, { timeout: 10000 });
    const after = await page.evaluate(() => localStorage.getItem("token"));
    check("Local Storage ไม่มี token แล้ว", !after);
    check("กลับไปหน้า login.html", page.url().includes("login.html"));
    const reuse = await apiJson("GET", "/api/repair-requests/my", { token });
    check("token เดิมใช้ต่อไม่ได้แล้ว (backend ตอบ 401)", reuse.status === 401, reuse.status);
    actual(`${res.status()} · token ถูกลบ · กลับ login.html · ใช้ token เดิมเรียก API ได้ ${reuse.status}`);
  }, { keep: true });

  await runCase("IT-U2-06", "หลังออกจากระบบ พิมพ์ URL หน้าโฮมตรงๆ", async ({ page, check, actual, note, rec }) => {
    await page.goto(UI + "/pages/home.html");
    await page.waitForURL(/login\.html/, { timeout: 10000 }).catch(() => {});
    await sleep(800);
    const data = rec.requests.filter((r) => r.path.startsWith("/api/repair-requests"));
    const leaked = data.filter((r) => r.status === 200);
    check("เด้งกลับ login.html", page.url().includes("login.html"), page.url());
    check("ไม่มีข้อมูลคำร้องถูกส่งกลับมา (ไม่มี response 200 จาก API ข้อมูล)", leaked.length === 0, `${leaked.length} ครั้ง`);
    if (data.length) note(`มี ${data.length} request ไป ${data[0].path} โดยไม่มี token แล้วได้ ${data[0].status ?? data[0].failed} เพราะ home.js เรียก API ต่อหลัง requireLogin() ไม่ได้ข้อมูลกลับไป แต่ต่างจากที่ออกแบบว่า "ไม่มี request"`);
    actual(`เด้งกลับ login.html · request ไป API ข้อมูล ${data.length} ครั้ง${data.length ? ` (ได้ ${data.map((d) => d.status ?? d.failed).join(", ")})` : ""}`);
  }, { session: s });
}

async function u3ReadCases() {
  await runCase("IT-U3-01", "resident01 เปิดหน้าประวัติคำร้อง", async ({ page, check, actual, note }) => {
    const res = await loginAndGo(page, "resident01", "/pages/history.html", "/api/repair-requests/my");
    const list = await res.json();
    state.r1List = list;
    check("GET /api/repair-requests/my แนบ Authorization", (res.request().headers()["authorization"] || "").startsWith("Bearer "));
    check("ได้ 200", res.status() === 200, res.status());
    await page.waitForFunction(() => !/กำลังโหลด/.test(document.getElementById("result-count").textContent));
    const items = await page.$$eval("#request-list li", (lis) => lis.map((li) => ({
      meta: li.querySelector('[data-field="meta"]')?.textContent || "",
      status: li.querySelector('[data-field="status"]')?.textContent.trim() || "",
    })));
    const ids = items.map((i) => Number((i.meta.match(/#(\d+)/) || [])[1]));
    check("จำนวนรายการบนหน้าเว็บเท่ากับที่ API ส่งมา", items.length === list.length, `เว็บ ${items.length} / API ${list.length}`);
    check("เรียงใหม่ไปเก่าตรงกับ API", JSON.stringify(ids) === JSON.stringify(list.map((r) => r.requestId)), ids.join(", "));
    const seedOrder = [1024, 1019, 1003].map((x) => ids.indexOf(x));
    check("มี #1024, #1019, #1003 เรียงตามลำดับนี้", seedOrder.every((x) => x >= 0) && seedOrder[0] < seedOrder[1] && seedOrder[1] < seedOrder[2], seedOrder.join(","));
    const badgeOk = items.every((it, i) => it.status === STATUS_TH[list[i]?.status]);
    check("ป้ายสถานะเป็นภาษาไทยตรงกับสถานะจาก API", badgeOk, items.map((i) => i.status).join(", "));
    const count = await text(page, "#result-count");
    check(`#result-count แสดง ${list.length}`, count === `ทั้งหมด ${list.length} รายการ`, count);
    if (list.length !== 3) note(`ฐานข้อมูลไม่ได้อยู่สภาพตั้งต้น (resident01 มี ${list.length} คำร้อง) จึงตรวจเทียบกับที่ API ส่งมาแทนตัวเลข 3`);
    actual(`200 ได้ ${list.length} รายการ · เรียง ${ids.map((x) => "#" + x).join(", ")} · ป้าย ${items.map((i) => i.status).join(", ")} · "${count}"`);
  });

  await runCase("IT-U3-02", "resident03 (ไม่มีคำร้อง) เปิดหน้าประวัติ", async ({ page, check, actual, rec }) => {
    const res = await loginAndGo(page, "resident03", "/pages/history.html", "/api/repair-requests/my");
    const list = await res.json();
    await page.waitForFunction(() => !/กำลังโหลด/.test(document.getElementById("result-count").textContent));
    const vis = await shown(page, "#empty-state");
    check("ได้ 200 และ []", res.status() === 200 && Array.isArray(list) && list.length === 0, JSON.stringify(list));
    check("#empty-state แสดง", vis, await text(page, "#empty-state"));
    check("ไม่มี error ใน Console", rec.console.length === 0, rec.console.join(" | "));
    actual(`${res.status()} ได้ ${JSON.stringify(list)} · #empty-state "${await text(page, "#empty-state")}" ${vis ? "แสดง" : "ไม่แสดง"} · Console error ${rec.console.length}`);
  });

  await runCase("IT-U3-03", "resident01 เปิดหน้าโฮม (สรุปจำนวนตามสถานะ)", async ({ page, check, actual }) => {
    const myWait = page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/my"), { timeout: 20000 }).catch(() => null);
    const res = await loginUI(page, "resident01");
    await page.waitForURL(/home\.html/);
    const my = await myWait;
    await page.waitForLoadState("networkidle");
    const list = my ? await my.json() : state.r1List;
    const want = ["PENDING", "IN_PROGRESS", "COMPLETED"].map((s) => list.filter((r) => r.status === s).length);
    const got = [await text(page, "#count-pending"), await text(page, "#count-in-progress"), await text(page, "#count-completed")].map(Number);
    const latest = await text(page, "#latest-request");
    check("เรียก GET /api/repair-requests/my", !!my && res.status() === 200);
    check(`ตัวเลข รอรับเรื่อง/กำลังดำเนินการ/เสร็จสิ้น = ${want.join(", ")}`, JSON.stringify(got) === JSON.stringify(want), got.join(", "));
    check(`#latest-request เป็น #${list[0]?.requestId}`, (latest || "").includes("#" + list[0]?.requestId), latest);
    actual(`ตัวเลข ${got.join(", ")} · คำร้องล่าสุด ${(latest || "").match(/#\d+/)?.[0] || "-"}`);
  });

  await runCase("IT-U3-04", "กดคำร้อง #1024 จากหน้าประวัติ", async ({ page, check, actual, note }) => {
    await loginAndGo(page, "resident01", "/pages/history.html", "/api/repair-requests/my");
    await page.waitForSelector("#request-list li");
    const link = page.locator("#request-list li a", { hasText: "#1024" });
    const [chk] = await Promise.all([
      page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/1024"), { timeout: 15000 }),
      link.click(),
    ]);
    await page.waitForLoadState("networkidle");
    check("กดแล้วไปหน้าตรวจสอบคำร้อง (request-check.html?id=1024) และได้ 200", page.url().includes("request-check.html?id=1024") && chk.status() === 200, page.url());
    check('ชื่อคำร้อง "ไฟห้องน้ำดับ"', (await text(page, "#request-title")) === "ไฟห้องน้ำดับ", await text(page, "#request-title"));
    check("สถานะ รอรับเรื่อง", (await text(page, "#request-status")) === "รอรับเรื่อง", await text(page, "#request-status"));
    const [det] = await Promise.all([
      page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/1024"), { timeout: 15000 }),
      page.click("#detail-link"),
    ]);
    await page.waitForLoadState("networkidle");
    const tech = await text(page, "#technician-name");
    const imgs = await page.locator("#image-list img").count();
    const tl = await page.$$eval("#timeline > li", (lis) => lis.map((li) => li.className));
    check("หน้ารายละเอียดได้ 200", det.status() === 200);
    check("ช่างแสดงว่ายังไม่มอบหมาย (ไม่ใช่ null)", tech === "ยังไม่มอบหมายช่าง", tech);
    check("รูป 1 รูป", imgs === 1, imgs);
    check("timeline ขั้นแรกเป็นขั้นปัจจุบัน", tl.length === 1 && tl[0].includes("is-current"), tl.join(" | "));
    note("ลำดับหน้าจอตอนนี้เป็น ประวัติ → ตรวจสอบคำร้อง → รายละเอียด จึงตรวจทั้งสองหน้า");
    actual(`ประวัติ → request-check (200) → request-detail (200) · "ไฟห้องน้ำดับ" · รอรับเรื่อง · ช่าง "${tech}" · รูป ${imgs} · timeline ${tl.length} ขั้น (${tl[0] || "-"})`);
  });

  await runCase("IT-U3-05", "เปิดคำร้อง #1019 (กำลังดำเนินการ เร่งด่วน มีช่าง)", async ({ page, check, actual, note }) => {
    await loginAndGo(page, "resident01", "/pages/request-check.html?id=1019", "/api/repair-requests/1019");
    await page.waitForLoadState("networkidle");
    const urgentCheck = await shown(page, "#request-urgency");
    check("หน้าตรวจสอบ: สถานะ กำลังดำเนินการ", (await text(page, "#request-status")) === "กำลังดำเนินการ");
    check("หน้าตรวจสอบ: มีป้ายเร่งด่วน", urgentCheck);
    await Promise.all([page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/1019")), page.click("#detail-link")]);
    await page.waitForLoadState("networkidle");
    const tech = await text(page, "#technician-name");
    const phone = await text(page, "#technician-phone");
    const appt = await text(page, "#appointment-datetime");
    const imgs = await page.locator("#image-list img").count();
    const notes = await page.$$eval("#timeline > li [data-field=note]", (ns) => ns.filter((n) => !n.classList.contains("is-hidden") && n.textContent.trim()).length);
    const tl = await page.locator("#timeline > li").count();
    check('ช่าง "วิชัย สายลม" 089-555-0148', tech === "วิชัย สายลม" && phone === "089-555-0148", `${tech} ${phone}`);
    check("นัด 14/10/2569 · 13:00", appt === "14/10/2569 · 13:00", appt);
    check("รูป 2 รูป", imgs === 2, imgs);
    check("timeline 2 ขั้นพร้อมหมายเหตุ", tl === 2 && notes === 2, `${tl} ขั้น หมายเหตุ ${notes}`);
    if (!(await page.locator("#request-urgency").count())) note("หน้ารายละเอียดไม่มีป้ายเร่งด่วน (ไม่มี #request-urgency ใน request-detail.html) ป้ายแสดงเฉพาะหน้าตรวจสอบคำร้อง");
    actual(`กำลังดำเนินการ · ป้ายเร่งด่วน${urgentCheck ? "แสดง" : "ไม่แสดง"} (หน้าตรวจสอบ) · ช่าง ${tech} ${phone} · นัด ${appt} · รูป ${imgs} · timeline ${tl} ขั้น หมายเหตุ ${notes}`);
  });

  await runCase("IT-U3-06", "เปิดคำร้อง #1003 (เสร็จสิ้น)", async ({ page, check, actual }) => {
    await loginAndGo(page, "resident01", "/pages/request-detail.html?id=1003", "/api/repair-requests/1003");
    await page.waitForLoadState("networkidle");
    const st = await text(page, "#request-status");
    const tl = await page.$$eval("#timeline > li", (lis) => lis.map((li) => li.className));
    check("สถานะ เสร็จสิ้น", st === "เสร็จสิ้น", st);
    check('timeline ครบ 3 ขั้น ทุกขั้นเป็น "ทำแล้ว" (is-done)', tl.length === 3 && tl.every((c) => c.includes("is-done")), tl.join(" | "));
    actual(`${st} · timeline ${tl.length} ขั้น: ${tl.map((c) => (c.includes("is-done") ? "ทำแล้ว" : c)).join(", ")}`);
  });

  for (const [id, title, rid, other] of [
    ["IT-U3-07", "เปิดคำร้องที่ไม่มีอยู่ (?id=9999)", 9999, null],
    ["IT-U3-08", "resident01 เปิดคำร้องของ resident02 (?id=987)", 987, ["บานพับตู้เสื้อผ้าหลุด", "มานี"]],
  ]) {
    await runCase(id, title, async ({ page, check, actual, note }) => {
      const res = await loginAndGo(page, "resident01", `/pages/request-detail.html?id=${rid}`, `/api/repair-requests/${rid}`);
      await page.waitForLoadState("networkidle");
      const body = await page.locator("body").innerText();
      const nf = await shown(page, "#not-found");
      check("ได้ 404", res.status() === 404, res.status());
      check('หน้าเว็บแสดง "ไม่พบคำร้อง"', nf || (await text(page, "#request-title")) === "ไม่พบคำร้อง", await text(page, "#request-title"));
      check("ไม่มีคำว่า undefined / null บนหน้า", !/\bundefined\b|\bnull\b/.test(body));
      if (other) check("ไม่เห็นข้อมูลของคนอื่น", other.every((w) => !body.includes(w)));
      const leftovers = ["มีน้ำหยดจากเครื่องปรับอากาศ", "รอการมอบหมาย"].filter((w) => body.includes(w));
      if (leftovers.length) note(`ข้อมูลตัวอย่างใน HTML ยังโชว์อยู่ใต้กล่องไม่พบคำร้อง (${leftovers.join(", ")}) ไม่ใช่ข้อมูลจริงของใคร แต่ทำให้ผู้ใช้สับสน ควรซ่อนส่วนรายละเอียดเมื่อไม่พบ`);
      actual(`${res.status()} · ${nf ? "กล่อง #not-found แสดง" : "ไม่มีกล่อง not-found"} · หัวข้อ "${await text(page, "#request-title")}"${other ? " · ไม่เห็นข้อมูล resident02" : ""}`);
    });
  }
}

async function u1Cases() {
  // IT-U1-01 แล้วต่อด้วย IT-U3-09 ในหน้าต่างเดิม (ใช้คำร้องที่เพิ่งสร้าง)
  const s = await runCase("IT-U1-01", "ส่งคำร้อง Baseline แนบ ok1.jpg", async ({ page, check, actual, note, rec }) => {
    await openForm(page);
    await fillBaseline(page);
    const res = await submitAndWait(page);
    const mp = formOf(rec);
    state.u1Acao = res.headers()["access-control-allow-origin"] || "";
    const { id, data } = await createdFromSuccess(page);
    state.u1 = { requestId: id, ...data };
    const keys = Object.keys(mp?.fields || {}).concat(mp?.files.length ? ["images"] : []);
    const missing = EXPECTED_KEYS.filter((k) => !keys.includes(k));
    check("POST /api/repair-requests แนบ Authorization", (res.request().headers()["authorization"] || "").startsWith("Bearer "));
    check("FormData มีครบทุกช่องตาม API spec", missing.length === 0, missing.length ? "ขาด " + missing.join(", ") : keys.join(", "));
    check("ค่าที่ส่งตรงกับที่กรอก", mp && mp.fields.locationType === "ROOM" && mp.fields.category === "ELECTRICAL" && mp.fields.title === BASE.equipment
      && mp.fields.preferredDate1 === TOMORROW && mp.fields.preferredSlot1 === "MORNING" && mp.fields.contactPhone === BASE.phone, JSON.stringify(mp?.fields));
    check("images 1 ไฟล์ (image/jpeg)", mp?.files.length === 1 && mp.files[0].type === "image/jpeg", mp?.files.map((f) => `${f.filename} ${f.type}`).join(", "));
    check("ได้ 201 พร้อม requestId (หน้าเว็บพาไป repair-success.html?id=เลขนั้น)", res.status() === 201 && id > 0, `${res.status()} id ${id}`);
    check("คำร้องที่สร้างมีสถานะ PENDING", data.status === "PENDING", data.status);
    await page.waitForLoadState("networkidle");
    const rid = await text(page, "#request-id");
    const rst = await text(page, "#request-status");
    check(`#request-id แสดง #${id}`, rid === "#" + id, rid);
    check('#request-status แสดง "รอรับเรื่อง"', rst === "รอรับเรื่อง", rst);
    if (id !== 1025) note(`ได้เลขคำร้อง ${id} (เอกสารคาดไว้ 1025 กรณีฐานข้อมูลเพิ่งสร้างใหม่ ไม่ถือว่าผิด)`);
    actual(`${res.status()} ได้ requestId ${id}, status ${data.status} · ไป repair-success.html · #request-id ${rid} · ${rst}`);
  }, { keep: true });

  await runCase("IT-U3-09", "กดตรวจสอบคำร้องจากหน้าส่งสำเร็จ (คำร้องที่สร้างใน IT-U1-01)", async ({ page, check, actual }) => {
    const id = state.u1?.requestId;
    if (!id) throw new Error("ไม่มีคำร้องจาก IT-U1-01");
    const [res] = await Promise.all([
      page.waitForResponse((r) => isApi(r, "GET", `/api/repair-requests/${id}`), { timeout: 15000 }),
      page.click("#check-request-link"),
    ]);
    await page.waitForLoadState("networkidle");
    const v = {
      title: await text(page, "#request-title"), area: await text(page, "#area-type"), loc: await text(page, "#location"),
      cat: await text(page, "#category"), desc: await text(page, "#description"), times: await text(page, "#preferred-times"),
      contact: await text(page, "#contact-info"),
    };
    check(`เปิด request-check.html?id=${id} ได้ 200`, page.url().includes(`request-check.html?id=${id}`) && res.status() === 200);
    check("ข้อมูลบนหน้าตรงกับที่กรอกทุกช่อง",
      v.title === BASE.equipment && v.area === "ห้องพัก" && v.loc === `${BASE.building} ${BASE.location}` && v.cat === "ไฟฟ้า"
      && v.desc === BASE.description && v.times === `${thaiDate(TOMORROW)} · ช่วงเช้า` && (v.contact || "").includes(BASE.phone), JSON.stringify(v));
    const [h] = await Promise.all([page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/my")), page.goto(UI + "/pages/history.html")]);
    await page.waitForSelector("#request-list li");
    const first = await page.locator("#request-list li").first().innerText();
    check(`กลับหน้าประวัติแล้วเห็น #${id} อยู่บนสุด`, first.includes("#" + id) && h.status() === 200, first.split("\n")[1] || first);
    actual(`200 · request-check แสดง ${v.title} / ${v.area} / ${v.loc} / ${v.cat} / ${v.times} / ${v.contact} · หน้าประวัติ #${id} อยู่บนสุด`);
  }, { session: s });

  await runCase("IT-U1-02", "Baseline + ช่วงเวลาที่ 2 + LINE ID + แนบ 3 รูป", async ({ page, check, actual, rec }) => {
    await openForm(page);
    await fillBaseline(page, { second: true, lineId: "somchai305", images: ["ok1.jpg", "ok2.jpg", "ok3.jpg"] });
    const res = await submitAndWait(page);
    const mp = formOf(rec);
    const { id } = await createdFromSuccess(page);
    const data = { requestId: id };
    state.u1multi = data;
    check("FormData มี preferredDate2, preferredSlot2 = AFTERNOON, lineId และ images 3 ไฟล์",
      mp && mp.fields.preferredDate2 === DAY_AFTER && mp.fields.preferredSlot2 === "AFTERNOON" && mp.fields.lineId === "somchai305" && mp.files.length === 3,
      JSON.stringify({ ...mp?.fields, images: mp?.files.length }));
    check("ได้ 201", res.status() === 201, res.status());
    await page.waitForLoadState("networkidle");
    await Promise.all([page.waitForResponse((r) => isApi(r, "GET", `/api/repair-requests/${data.requestId}`)), page.click("#check-request-link")]);
    await page.waitForLoadState("networkidle");
    const times = await text(page, "#preferred-times");
    const want = `${thaiDate(TOMORROW)} · ช่วงเช้า / ${thaiDate(DAY_AFTER)} · ช่วงบ่าย`;
    check("ช่วงเวลาที่สะดวกครบ 2 ช่วง", times === want, times);
    await Promise.all([page.waitForResponse((r) => isApi(r, "GET", `/api/repair-requests/${data.requestId}`)), page.click("#detail-link")]);
    await page.waitForLoadState("networkidle");
    const imgs = await page.locator("#image-list img").count();
    check("หน้ารายละเอียดเห็นรูป 3 รูป", imgs === 3, imgs);
    actual(`${res.status()} requestId ${data.requestId} · ช่วงเวลา "${times}" · รูป ${imgs} รูป`);
  });

  await runCase("IT-U1-03", "เลือกพื้นที่ส่วนกลาง", async ({ page, check, actual, rec }) => {
    await openForm(page);
    await fillBaseline(page, { common: true });
    const res = await submitAndWait(page);
    const mp = formOf(rec);
    const { id } = await createdFromSuccess(page);
    const data = { requestId: id };
    check("ส่ง locationType: COMMON_AREA", mp?.fields.locationType === "COMMON_AREA", mp?.fields.locationType);
    check("ได้ 201", res.status() === 201, res.status());
    await page.waitForLoadState("networkidle");
    await Promise.all([page.waitForResponse((r) => isApi(r, "GET", `/api/repair-requests/${data.requestId}`)), page.click("#check-request-link")]);
    await page.waitForLoadState("networkidle");
    const area = await text(page, "#area-type");
    check("หน้าตรวจสอบแสดงประเภทพื้นที่เป็นพื้นที่ส่วนกลาง", area === "พื้นที่ส่วนกลาง", area);
    actual(`${res.status()} requestId ${data.requestId} · locationType ${mp?.fields.locationType} · หน้าเว็บแสดง "${area}"`);
  });

  await runCase("IT-U1-04", "แนบรูป mid.jpg ขนาด 3 MB", async ({ page, check, actual, rec }) => {
    await openForm(page);
    await fillBaseline(page, { images: ["mid.jpg"] });
    const res = await submitAndWait(page);
    const mp = formOf(rec);
    const size = mp?.files[0]?.size || 0;
    check("ส่งรูป 1 ไฟล์ขนาดประมาณ 3 MB", mp?.files.length === 1 && size > 3_000_000 && size <= 5 * 1048576, `${(size / 1048576).toFixed(2)} MB`);
    check("ได้ 201 (ไม่เกิน 5 MB)", res.status() === 201, res.status());
    let id = null;
    if (res.status() === 201) ({ id } = await createdFromSuccess(page));
    actual(`ส่งรูป ${(size / 1048576).toFixed(2)} MB · ได้ ${res.status()}${id ? ` requestId ${id}` : ""}`);
  });

  await runCase("IT-U1-05", "แนบรูป big.jpg เกิน 5 MB", async (t) => {
    await openForm(t.page);
    await fillBaseline(t.page, { images: [] });
    await t.page.setInputFiles("#images", fx("big.jpg"));
    await checkNoPostAndMessage(t, "5MB", "ขนาดรูปเกิน 5MB");
    t.note('ข้อความจริงคือ "รูปแต่ละรูปต้องมีขนาดไม่เกิน 5MB" ต่างจากในเอกสาร ("รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB") แต่ความหมายเดียวกัน');
  });

  await runCase("IT-U1-06", "เลือกรูป 4 รูป (ok1–ok4)", async (t) => {
    await openForm(t.page);
    await fillBaseline(t.page, { images: [] });
    await t.page.setInputFiles("#images", ["ok1.jpg", "ok2.jpg", "ok3.jpg", "ok4.jpg"].map(fx));
    const left = await t.page.$eval("#images", (el) => el.files.length);
    const disabled = await t.page.$eval("#submit-btn", (el) => el.disabled);
    await checkNoPostAndMessage(t, "แนบรูปได้ไม่เกิน 3 รูป", "แนบเกิน 3 รูป");
    t.note(`หน้าเว็บล้างรูปที่เลือกทิ้งทั้งหมด (เหลือ ${left} ไฟล์) แทนการปิดปุ่มส่ง${disabled ? "" : " ปุ่มส่งยังกดได้"} ต่างจากที่ออกแบบไว้แต่ผลคือส่ง 4 รูปไม่ได้เหมือนกัน`);
  });

  await runCase("IT-U1-07", "Baseline แต่ไม่แนบรูป", async ({ page, check, actual, rec }) => {
    await openForm(page);
    await fillBaseline(page, { images: [] });
    await page.click("#submit-btn");
    await sleep(600);
    const msg = (await text(page, "#images-error")) || "";
    const vis = await shown(page, "#images-error");
    check("ไม่มี POST ไป backend", posts(rec).length === 0, `POST ${posts(rec).length} ครั้ง`);
    check("#images-error เตือนให้แนบรูปอย่างน้อย 1 รูป", msg.includes("อย่างน้อย 1 รูป"), `"${msg}"`);
    check("ผู้ใช้มองเห็นข้อความเตือนบนหน้าจอ", vis, vis ? "" : `ข้อความถูกซ่อนอยู่ (display: ${await displayOf(page, "#images-error")})`);
    actual(`ไม่มี request · #images-error = "${msg}" · ${vis ? "มองเห็นบนหน้าจอ" : "มองไม่เห็นบนหน้าจอ (CSS ซ่อน)"}`);
  });

  await runCase("IT-U1-08", "Baseline แนบไฟล์ doc.pdf", async (t) => {
    await openForm(t.page);
    await fillBaseline(t.page, { images: [] });
    await t.page.setInputFiles("#images", fx("doc.pdf"));
    await checkNoPostAndMessage(t, "JPG", "ชนิดไฟล์ต้องเป็น JPG/PNG");
    t.note('ข้อความจริงคือ "รองรับเฉพาะไฟล์ JPG และ PNG" ไม่ใช่ข้อความเดียวกับ IT-U1-05 ตามเอกสาร แต่บอกสาเหตุได้ตรงกว่า');
  });

  await runCase("IT-U1-09", "ดับเบิลคลิกปุ่มส่ง (กันส่งซ้ำ)", async ({ page, check, actual, note, rec }) => {
    await openForm(page);
    await fillBaseline(page);
    const apiToken = (await apiJson("POST", "/api/auth/login", { body: { username: "resident01", password: PASSWORD } })).data?.token;
    const countBefore = (await apiJson("GET", "/api/repair-requests/my", { token: apiToken })).data?.length ?? null;
    // หน่วง response 1.2 วินาทีให้เหมือนเน็ตช้า จะได้เห็นว่าปุ่มถูกปิดระหว่างรอจริง
    await page.route(API + "/api/repair-requests", async (route) => { await sleep(1200); await route.continue(); });
    await page.dblclick("#submit-btn");
    await sleep(150);
    const disabledWhileWaiting = await page.$eval("#submit-btn", (el) => el.disabled);
    await page.waitForURL(/repair-success/, { timeout: 15000 });
    await sleep(500);
    const countAfter = (await apiJson("GET", "/api/repair-requests/my", { token: apiToken })).data?.length ?? null;
    check("มี POST แค่ 1 ครั้ง", posts(rec).length === 1, `${posts(rec).length} ครั้ง`);
    check("#submit-btn ถูกปิดระหว่างรอ", disabledWhileWaiting);
    if (countBefore != null) check("ได้คำร้องใหม่แค่ 1 ใบ", countAfter - countBefore === 1, `${countBefore} → ${countAfter}`);
    note("สคริปต์หน่วงเวลา response 1.2 วินาทีเพื่อจำลองเน็ตช้า");
    actual(`POST ${posts(rec).length} ครั้ง · ปุ่ม${disabledWhileWaiting ? "ถูกปิด" : "ไม่ถูกปิด"}ระหว่างรอ · คำร้องเพิ่ม ${countAfter - countBefore} ใบ`);
  });
}

async function xCases() {
  await runCase("IT-X-01", "CORS ระหว่าง localhost:3000 กับ localhost:8080", async ({ page, check, actual, rec }) => {
    const pre = await fetch(API + "/api/repair-requests", {
      method: "OPTIONS",
      headers: { Origin: UI, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization" },
    });
    const acao = pre.headers.get("access-control-allow-origin");
    check("preflight (OPTIONS) ได้ 200", pre.status === 200, pre.status);
    check(`preflight ตอบ Access-Control-Allow-Origin: ${UI}`, acao === UI, acao);
    check(`POST จริงใน IT-U1-01 ตอบ Access-Control-Allow-Origin: ${UI}`, state.u1Acao === UI, state.u1Acao || "-");
    const id = state.u1?.requestId || 1024;
    await loginAndGo(page, "resident01", `/pages/request-check.html?id=${id}`, `/api/repair-requests/${id}`);
    await page.waitForLoadState("networkidle");
    const corsErr = results.flatMap((r) => r.console).concat(rec.console).filter((c) => /CORS|Access-Control/i.test(c));
    check("ไม่มี CORS error ใน Console ตลอดการทดสอบ", corsErr.length === 0, corsErr[0] || "");
    actual(`preflight ${pre.status} · Allow-Origin "${acao}" · POST Allow-Origin "${state.u1Acao}" · CORS error ${corsErr.length}`);
  });

  await runCase("IT-X-02", "resident02 เห็นเฉพาะคำร้องของตัวเอง (backend อ่านผู้ใช้จาก token)", async ({ page, check, actual, note }) => {
    await loginUI(page, "resident02");
    await page.waitForURL(/home\.html/);
    await page.waitForLoadState("networkidle");
    const room = await text(page, "#user-room");
    const [res] = await Promise.all([page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/my")), page.goto(UI + "/pages/history.html")]);
    await page.waitForSelector("#request-list li, #empty-state:not(.is-hidden)");
    const h = res.request().headers();
    const metas = await page.$$eval("#request-list li [data-field=meta]", (ms) => ms.map((m) => m.textContent));
    check("GET /my แนบ token ของ resident02 และไม่มี header X-User-Id", (h["authorization"] || "").startsWith("Bearer ") && !h["x-user-id"]);
    check("เห็นแค่ #987", metas.length === 1 && metas[0].includes("#987"), metas.join(" | "));
    if (room !== "B-210") note(`พบเพิ่มเติม: หน้าโฮมของ resident02 แสดงห้อง "${room}" แทน B-210 (เลขห้องตายตัวใน home.html เพราะ login ไม่ส่ง roomNumber)`);
    actual(`${res.status()} · เห็น ${metas.length} รายการ: ${metas.map((m) => m.match(/#\d+/)?.[0]).join(", ")} · ไม่มี X-User-Id`);
  });

  await runCase("IT-X-03", "แก้ token ใน Local Storage เป็นค่าปลอมแล้วรีเฟรช", async ({ page, check, actual }) => {
    await loginAndGo(page, "resident01", "/pages/history.html", "/api/repair-requests/my");
    await page.evaluate(() => localStorage.setItem("token", "abc"));
    const [res] = await Promise.all([page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/my")), page.reload()]);
    await page.waitForURL(/login\.html/, { timeout: 10000 }).catch(() => {});
    const auth = res.request().headers()["authorization"];
    const token = await page.evaluate(() => localStorage.getItem("token"));
    check("ส่ง GET /my แนบ token ปลอม (Bearer abc)", auth === "Bearer abc", auth);
    check("ได้ 401", res.status() === 401, res.status());
    check("ลบ token แล้วเด้งไป login.html", !token && page.url().includes("login.html"), page.url());
    actual(`ส่ง ${auth} · ได้ ${res.status()} · token ถูกลบ · ไป ${new URL(page.url()).pathname}`);
  });

  await runCase("IT-X-04", "รูปประกอบโหลดจาก backend ได้ (/uploads)", async ({ page, check, actual, note }) => {
    const shots = [];
    page.on("response", (r) => { if (r.url().startsWith(API + "/uploads/")) shots.push({ path: new URL(r.url()).pathname, status: r.status() }); });
    await loginAndGo(page, "resident01", "/pages/request-detail.html?id=1019", "/api/repair-requests/1019");
    await page.waitForLoadState("networkidle");
    const nat = await page.$$eval("#image-list img", (imgs) => imgs.map((i) => i.naturalWidth));
    const seed = shots.filter((s) => /\/uploads\/1019-[12]\./.test(s.path));
    check("รูปตัวอย่างของ #1019 ทั้ง 2 รูปได้ 200", seed.length === 2 && seed.every((s) => s.status === 200), seed.map((s) => `${s.path} ${s.status}`).join(", ") || "ไม่มี request รูป");
    check("รูปของ #1019 แสดงครบ ไม่มีไอคอนรูปเสีย", nat.length === 2 && nat.every((w) => w > 0), `naturalWidth ${nat.join(", ")}`);
    if (seed.some((s) => s.status === 404)) note("ไฟล์รูปตัวอย่างจาก init.sql (1024-1.jpg, 1019-1.jpg, 1019-2.jpg, 1003-1.jpg, 987-1.jpg) ไม่มีใน backend/uploads เพราะโฟลเดอร์ uploads ถูก .gitignore เครื่องที่ clone ใหม่ (เช่นเครื่อง Lab) จะเห็นรูปเสียทุกคำร้องตัวอย่าง");
    let upl = "";
    if (state.u1multi?.requestId) {
      const id = state.u1multi.requestId;
      await Promise.all([page.waitForResponse((r) => isApi(r, "GET", `/api/repair-requests/${id}`)), page.goto(UI + `/pages/request-detail.html?id=${id}`)]);
      await page.waitForLoadState("networkidle");
      const n2 = await page.$$eval("#image-list img", (imgs) => imgs.map((i) => i.naturalWidth));
      check(`รูปที่อัปโหลดเองใน IT-U1-02 (#${id}) แสดงครบ 3 รูป`, n2.length === 3 && n2.every((w) => w > 0), `naturalWidth ${n2.join(", ")}`);
      upl = ` · รูปที่อัปโหลดเอง #${id}: ${n2.filter((w) => w > 0).length}/${n2.length} แสดงได้`;
      await page.goto(UI + "/pages/request-detail.html?id=1019");
      await page.waitForLoadState("networkidle");
    }
    actual(`รูปตัวอย่าง #1019: ${seed.map((s) => `${s.path.split("/").pop()} ${s.status}`).join(", ") || "-"}${upl}`);
  });

  await runCase("IT-X-05", "ภาษาไทยแสดงถูกต้องทุกหน้า", async ({ page, check, actual }) => {
    await loginAndGo(page, "resident01", "/pages/history.html", "/api/repair-requests/my");
    await page.waitForSelector("#request-list li");
    const listText = await page.locator("#request-list").innerText();
    const hist = ["ไฟห้องน้ำดับ", "ก๊อกน้ำอ่างล้างหน้ารั่ว", "แอร์ไม่เย็น"].filter((w) => listText.includes(w));
    await Promise.all([page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/1003")), page.goto(UI + "/pages/request-detail.html?id=1003")]);
    await page.waitForLoadState("networkidle");
    const tlText = await page.locator("#timeline").innerText();
    check("ชื่อคำร้องตัวอย่างภาษาไทยครบ 3 รายการ", hist.length === 3, hist.join(", "));
    check("หมายเหตุ timeline ภาษาไทยถูกต้อง", tlText.includes("ล้างแผ่นกรองและเติมน้ำยาแอร์ ใช้งานได้ปกติ"), tlText.split("\n").slice(0, 3).join(" / "));
    let roundtrip = "ข้าม (ไม่มีคำร้องจาก IT-U1-01)";
    if (state.u1?.requestId) {
      const id = state.u1.requestId;
      await Promise.all([page.waitForResponse((r) => isApi(r, "GET", `/api/repair-requests/${id}`)), page.goto(UI + `/pages/request-detail.html?id=${id}`)]);
      await page.waitForLoadState("networkidle");
      const t1 = await text(page, "#request-title");
      const d1 = await text(page, "#request-description");
      check("ข้อความไทยที่ส่งจากฟอร์มกลับมาตรงทุกตัวอักษร (ฟอร์ม → DB → หน้าเว็บ)", t1 === BASE.equipment && d1 === BASE.description, `${t1} / ${d1}`);
      roundtrip = `"${t1}"`;
    }
    const body = await page.locator("body").innerText();
    check("ไม่มี ??? หรือตัวอักษรเพี้ยน", !/\?\?|�/.test(body + listText + tlText));
    actual(`ชื่อคำร้อง ${hist.length}/3 · timeline ถูกต้อง · ข้อความที่ส่งไป-กลับ ${roundtrip}`);
  });
}

async function u1BackendDown() {
  await runCase("IT-U1-10", "หยุด backend แล้วกดส่ง", async ({ page, check, actual, note, skip, rec }) => {
    if (SKIP_STOP) { skip("สั่งข้ามด้วย --skip-backend-stop"); return; }
    await openForm(page);
    await fillBaseline(page);
    const stop = docker(["stop", "backend"]);
    if (!stop.ok) { skip(`สั่ง docker compose stop backend ไม่ได้: ${stop.out.split("\n").pop()}`); return; }
    try {
      await page.click("#submit-btn");
      await page.waitForEvent("dialog", { timeout: 8000 }).catch(() => {});
      await sleep(800);
      const failed = posts(rec).filter((r) => r.failed);
      const kept = await page.inputValue("#equipment");
      const disabled = await page.$eval("#submit-btn", (el) => el.disabled);
      const msg = rec.dialogs.join(" | ");
      check("POST ล้มเหลวเพราะต่อ backend ไม่ได้", failed.length === 1, failed.map((f) => f.failed).join(", ") || `POST ${posts(rec).length} ครั้ง`);
      check("แสดงข้อความว่าเชื่อมต่อเซิร์ฟเวอร์ไม่ได้", /เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/.test(msg), msg || "ไม่มีข้อความ");
      check("ข้อมูลในฟอร์มไม่หาย", kept === BASE.equipment, kept);
      check("กดส่งใหม่ได้ (ปุ่มไม่ถูกปิดค้าง)", !disabled);
      note("หน้าเว็บแสดงข้อความด้วย alert() เพราะ repair-form.html ไม่มีกล่อง #form-error");
      actual(`POST ${failed[0]?.failed || "-"} · alert "${msg}" · ข้อมูลในฟอร์มยังอยู่ · ปุ่ม${disabled ? "ถูกปิด" : "กดได้"}`);
    } finally {
      docker(["start", "backend"]);
      const up = await waitBackend(150000);
      if (!up) note("เปิด backend กลับไม่ทันใน 150 วินาที ให้สั่ง docker compose start backend เอง");
    }
  });
}

// ================================================================ main
async function main() {
  await fs.mkdir(OUT, { recursive: true });
  console.log(`D20 Integration Test UI ↔ API · หน้าเว็บ ${UI} · backend ${API}`);

  const ui = await fetch(UI + "/pages/login.html").then((r) => r.status).catch(() => 0);
  if (ui !== 200) throw new Error(`เปิด ${UI} ไม่ได้ (รัน docker compose up --build ก่อน)`);
  if (!(await waitBackend(60000))) throw new Error(`backend ที่ ${API} ยังไม่พร้อม (ดู log ด้วย docker compose logs backend)`);

  await launch();
  console.log(`เบราว์เซอร์: ${browserName}\n`);
  await makeFixtures();

  await u2Cases();
  await u3ReadCases();
  await u1Cases();
  await xCases();
  await u1BackendDown();
  await browser.close();

  const order = (id) => {
    const [, g, n] = id.match(/IT-(U2|U1|U3|X)-(\d+)/);
    return ["U2", "U1", "U3", "X"].indexOf(g) * 100 + Number(n);
  };
  results.sort((a, b) => order(a.id) - order(b.id));
  const count = (s) => results.filter((r) => r.status === s).length;
  const label = { pass: "ผ่าน", fail: "ไม่ผ่าน", skip: "รันไม่ได้" };
  const stamp = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  let md = `# ผล D20 · Integration Test UI ↔ API (Sprint 1)\n\n`;
  md += `รันเมื่อ ${stamp} · หน้าเว็บ ${UI} · backend ${API} · เบราว์เซอร์ ${browserName}\n\n`;
  md += `**ผ่าน ${count("pass")} · ไม่ผ่าน ${count("fail")} · รันไม่ได้ ${count("skip")} จาก ${results.length} เคส**\n\n`;
  md += `| ID | ผล | ผลจริง | หลักฐาน |\n|---|---|---|---|\n`;
  for (const r of results) md += `| ${r.id} | ${label[r.status]} | ${(r.actual.join(" · ") || r.error || r.skipped || "").replace(/\|/g, "/")} | ${r.id}.png |\n`;
  md += `\n## รายละเอียดรายเคส\n`;
  for (const r of results) {
    md += `\n### ${r.id} ${r.title} — ${label[r.status]}\n\n`;
    for (const c of r.checks) md += `- ${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}\n`;
    if (r.error) md += `- ✗ error: ${r.error}\n`;
    if (r.skipped) md += `- รันไม่ได้: ${r.skipped}\n`;
    for (const n of r.notes) md += `- หมายเหตุ: ${n}\n`;
    const reqs = r.requests.map((q) => `${q.method} ${q.path} → ${q.failed || q.status}`);
    if (reqs.length) md += `- request: ${reqs.join(" · ")}\n`;
  }
  await fs.writeFile(path.join(OUT, "d20-results.md"), md);
  await fs.writeFile(path.join(OUT, "d20-results.json"), JSON.stringify({ ranAt: stamp, ui: UI, api: API, browser: browserName, results: results.map(({ requests, ...r }) => ({ ...r, requests: requests.map(({ headers, ...q }) => q) })) }, null, 2));
  console.log(`\nผ่าน ${count("pass")} · ไม่ผ่าน ${count("fail")} · รันไม่ได้ ${count("skip")} จาก ${results.length} เคส`);
  console.log(`ผลอยู่ที่ ${path.join(path.relative(process.cwd(), OUT), "d20-results.md")}`);
  process.exitCode = count("fail") ? 1 : 0;
}

main().catch(async (e) => {
  console.error("\nหยุดทำงาน: " + e.message);
  try { await browser?.close(); } catch { /* ignore */ }
  process.exit(2);
});
