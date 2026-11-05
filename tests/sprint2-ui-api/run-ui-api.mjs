// Task53 · Integration Test UI ↔ API (Sprint 2, U4–U8) · ระบบแจ้งซ่อมหอพัก CS261 กลุ่ม 3
// รันตามตาราง Test Case ของ Task34 (unit_test_ui_sprint2) ที่ปรับให้ตรงกับระบบจริงแล้ว (case-spec.json)
// ใช้เบราว์เซอร์จริงเปิดหน้าเว็บที่ localhost:3000 แล้วตรวจทั้งหน้าจอและ request/response ที่วิ่งไป backend
//
// วิธีรัน (ต้องเริ่มจากฐานข้อมูลใหม่ เพราะเคสอ้างอิงข้อมูลตั้งต้นใน init.sql):
//   cd tests/sprint2-ui-api
//   npm install
//   node run-ui-api.mjs --reset      สั่ง docker compose down -v / up -d --build ให้เอง แล้วรันทุกเคส
//   node run-ui-api.mjs              รันกับระบบที่เปิดอยู่ (ต้อง docker compose down -v แล้ว up --build มาก่อน)
//   node run-ui-api.mjs --headed     เปิดหน้าต่างเบราว์เซอร์ให้ดูตอนรัน
// ผลอยู่ใน results/<วันที่_เวลา>/ : ui-api-results.md, ui-api-results.json, ui-api-results.csv และรูปหลักฐาน <TC ID>.png

import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..", "..");
const RUN_STAMP = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
  .format(new Date()).replace(" ", "_").replace(":", "-");
const OUT = path.join(HERE, "results", RUN_STAMP);
const RAW = path.join(OUT, "raw");
const FIX = path.join(HERE, "results", "fixtures");
const SPEC = JSON.parse(readFileSync(path.join(HERE, "case-spec.json"), "utf8")).cases;

const UI = (process.env.UI_URL || "http://localhost:3000").replace(/\/$/, "");
const API = (process.env.API_URL || "http://localhost:8080").replace(/\/$/, "");
const ARGS = process.argv.slice(2);
const HEADED = ARGS.includes("--headed");
const RESET = ARGS.includes("--reset");
const ONLY = (ARGS.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const PASSWORD = "password123";

const DESKTOP = { width: 1280, height: 860 };
const MOBILE = { width: 393, height: 852 };
const USER_ID = { resident01: 1, resident02: 2, staff01: 4, tech01: 5, tech02: 6, tech03: 7, tech04: 8, tech05: 9, tech07: 11 };
const HOME = { RESIDENT: /home\.html/, STAFF: /staff-requests\.html/, TECHNICIAN: /technician-tasks\.html/ };
const ROLE = (u) => (u.startsWith("staff") ? "STAFF" : u.startsWith("tech") ? "TECHNICIAN" : "RESIDENT");

// ---------------------------------------------------------------- utils
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bangkokDate = (offsetDays) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" })
  .format(new Date(Date.now() + offsetDays * 86400000));
const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thShort = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${d} ${TH_SHORT[m - 1]} ${y + 543}`; };
const thLong = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(y, m - 1, d)); };
const D = (n) => bangkokDate(n);
const short = (s, n = 90) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };

const isApi = (res, method, p) => {
  const u = new URL(res.url());
  return res.request().method() === method && u.origin === API && (typeof p === "string" ? u.pathname === p : p.test(u.pathname));
};

const tokens = {};
async function tokenOf(user) {
  if (tokens[user]) return tokens[user];
  const r = await apiJson("POST", "/api/auth/login", { body: { username: user, password: PASSWORD } });
  if (r.status !== 200 || !r.data?.token) throw new Error(`login ${user} ผ่าน API ไม่สำเร็จ (${r.status})`);
  return (tokens[user] = r.data.token);
}
async function apiJson(method, p, { token, body, user } = {}) {
  const headers = { Origin: UI };
  if (user) token = await tokenOf(user);
  if (token) headers.Authorization = "Bearer " + token;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(API + p, { method, headers, body: payload });
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  return { status: res.status, data };
}
const staffDetail = async (id) => (await apiJson("GET", `/api/staff/repair-requests/${id}`, { user: "staff01" })).data || {};
// backend จำกัด size ไม่เกิน 50 ต่อหน้า จึงดึงทีละหน้าจนครบ
async function staffAll() {
  const all = [];
  for (let p = 0; p < 50; p++) {
    const r = await apiJson("GET", `/api/staff/repair-requests?page=${p}&size=50`, { user: "staff01" });
    if (r.status !== 200 || !Array.isArray(r.data?.content)) throw new Error(`GET /api/staff/repair-requests ตอบ ${r.status} ${r.data?.message || ""}`);
    all.push(...r.data.content);
    if (p + 1 >= (r.data.totalPages || 0)) break;
  }
  return all;
}

async function waitBackend(timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(API + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "staff01", password: PASSWORD }) });
      if (r.status === 200) return true;
    } catch { /* not up yet */ }
    await sleep(3000);
  }
  return false;
}
function docker(args, timeout = 600000) {
  const r = spawnSync("docker", ["compose", ...args], { cwd: PROJECT_ROOT, encoding: "utf8", timeout });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim() };
}

// ---------------------------------------------------------------- browser
let browser;
let browserName = "";
async function launch() {
  const tries = process.env.PW_CHANNEL ? [process.env.PW_CHANNEL] : ["chrome", "msedge", null];
  for (const channel of tries) {
    try {
      browser = await chromium.launch({ channel: channel || undefined, executablePath: process.env.PW_EXECUTABLE || undefined, headless: !HEADED, slowMo: HEADED ? 120 : 0 });
      browserName = `${channel || "chromium"} ${browser.version()}`;
      return;
    } catch { /* try next */ }
  }
  throw new Error("เปิดเบราว์เซอร์ไม่ได้: ต้องมี Google Chrome หรือ Microsoft Edge ในเครื่อง (หรือรัน npx playwright-core install chromium)");
}

// ---------------------------------------------------------------- fixtures (รูปทดสอบสร้างใหม่ทุกรอบ)
async function makeFixtures() {
  await fs.mkdir(FIX, { recursive: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent("<canvas id=c width=640 height=480></canvas>");
  const draw = async (label, color, type) => {
    const b64 = await page.evaluate(([label, color, type]) => {
      const c = document.getElementById("c");
      const g = c.getContext("2d");
      g.fillStyle = color; g.fillRect(0, 0, 640, 480);
      g.fillStyle = "#fff"; g.font = "bold 46px sans-serif"; g.fillText(label, 40, 120);
      g.font = "26px sans-serif"; g.fillText("รูปทดสอบ Task53 · CS261 กลุ่ม 3", 40, 180);
      for (let i = 0; i < 40; i++) { g.fillStyle = `hsl(${i * 9},70%,60%)`; g.fillRect(40 + i * 14, 300, 10, 120); }
      return c.toDataURL(type, 0.92).split(",")[1];
    }, [label, color, type]);
    return Buffer.from(b64, "base64");
  };
  const colors = ["#087f78", "#2563eb", "#b45309", "#9333ea"];
  for (let i = 1; i <= 4; i++) await fs.writeFile(path.join(FIX, `ok${i}.jpg`), await draw(`ok${i}.jpg`, colors[i - 1], "image/jpeg"));
  await fs.writeFile(path.join(FIX, "ok_png.png"), await draw("ok_png.png", "#0f766e", "image/png"));
  const pad = (buf, size) => Buffer.concat([buf, Buffer.alloc(size - buf.length, 0)]);
  await fs.writeFile(path.join(FIX, "big.jpg"), pad(await draw("big.jpg 5.5MB", "#b91c1c", "image/jpeg"), Math.round(5.5 * 1024 * 1024)));
  await fs.writeFile(path.join(FIX, "doc.pdf"), "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  await ctx.close();
}
const fx = (name) => path.join(FIX, name);

// ---------------------------------------------------------------- case runner
const results = [];
let activeRec = null;

// เบราว์เซอร์ไม่ให้อ่าน body ของ request ที่มีไฟล์ จึงบันทึก FormData ที่ JS ส่งให้ fetch แทน (ส่งต่อค่าเดิมทุกอย่าง)
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
        window.__t53Form(JSON.stringify({ url: String(input), method: init.method || "GET", fields, files }));
      }
    } catch (e) { /* ไม่ให้กระทบหน้าเว็บ */ }
    return orig.apply(this, arguments);
  };
};

async function newSession(viewport = DESKTOP) {
  const ctx = await browser.newContext({ viewport, locale: "th-TH", timezoneId: "Asia/Bangkok", isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  await ctx.exposeFunction("__t53Form", (json) => { try { activeRec?.forms.push(JSON.parse(json)); } catch { /* ignore */ } });
  await ctx.addInitScript(RECORD_FORMDATA);
  const page = await ctx.newPage();
  return { ctx, page };
}

function attach(page, rec) {
  const map = new Map();
  const onReq = (req) => {
    if (!req.url().startsWith(API)) return;
    const u = new URL(req.url());
    const entry = { method: req.method(), path: u.pathname + u.search, auth: req.headers()["authorization"] || "", status: null, failed: null };
    if (req.method() === "POST" || req.method() === "PUT") {
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
    if ((res.headers()["content-type"] || "").includes("json")) {
      try { e.json = await res.json(); } catch { /* ignore */ }
    }
  };
  const onFail = (req) => { const e = map.get(req); if (e) e.failed = req.failure()?.errorText || "failed"; };
  const onConsole = (msg) => {
    if (msg.type() !== "error") return;
    const src = msg.location()?.url || "";
    if (/favicon/i.test(msg.text() + src)) return;
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

function shouldRun(id) { return !ONLY.length || ONLY.includes(id); }

async function runCase(id, fn, { viewport = DESKTOP, keep = false, session } = {}) {
  if (!shouldRun(id)) return null;
  const spec = SPEC[id] || {};
  const rec = { id, title: spec.expected || "", mode: spec.mode || "auto", status: "fail", checks: [], notes: [], actual: [], requests: [], forms: [], console: [], dialogs: [], shots: [], error: null };
  const s = session || (await newSession(viewport));
  activeRec = rec;
  const detach = attach(s.page, rec);
  const t = {
    page: s.page, ctx: s.ctx, rec,
    check: (name, ok, detail = "") => { rec.checks.push({ name, ok: !!ok, detail: String(detail ?? "") }); return !!ok; },
    note: (text) => rec.notes.push(text),
    actual: (text) => rec.actual.push(text),
    skip: (reason) => { rec.skipped = reason; },
    shot: async (name, page = s.page) => {
      await fs.mkdir(OUT, { recursive: true });
      const file = `${id}_${name}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      rec.shots.push(file);
    },
  };
  try {
    await fn(t);
  } catch (e) {
    rec.error = e.message.split("\n")[0];
  }
  await sleep(200);
  detach();
  activeRec = null;
  if (rec.mode === "manual") rec.status = rec.error ? "skip" : "manual";
  else if (rec.skipped) rec.status = "skip";
  else rec.status = !rec.error && rec.checks.length && rec.checks.every((c) => c.ok) ? "pass" : "fail";
  try { await evidence(s.page, rec); } catch (e) { rec.notes.push("แคปหน้าจอไม่สำเร็จ: " + e.message); }
  if (!keep && !session) await s.ctx.close();
  results.push(rec);
  const mark = { pass: "✓ ผ่าน    ", fail: "✗ ไม่ผ่าน ", skip: "– รันไม่ได้", manual: "◎ ให้คนตรวจ" }[rec.status];
  const why = rec.status === "fail" ? "  ← " + (rec.error || rec.checks.find((c) => !c.ok)?.name || "") : rec.status === "skip" ? "  ← " + (rec.skipped || rec.error) : "";
  console.log(`${mark} ${id}${why}`);
  return s;
}

function naCases() {
  for (const [id, spec] of Object.entries(SPEC)) {
    if (spec.mode !== "na" || !shouldRun(id)) continue;
    results.push({ id, mode: "na", status: "na", title: "", checks: [], notes: [], actual: [spec.na], requests: [], forms: [], console: [], dialogs: [], shots: [] });
    console.log(`  N/A      ${id}`);
  }
}

// ---------------------------------------------------------------- evidence image
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

async function evidence(page, rec) {
  await fs.mkdir(RAW, { recursive: true });
  let shot = null;
  if (!page.isClosed() && page.url() !== "about:blank") {
    shot = await page.screenshot({ path: path.join(RAW, `${rec.id}-page.png`), fullPage: true });
  }
  let formIdx = 0;
  const reqRows = rec.requests.map((r) => {
    let info = "";
    if (r.multipart) {
      const f = rec.forms[formIdx++];
      info = f ? `FormData: ${Object.keys(f.fields).join(", ")} · ${f.files.map((x) => `${x.field}=${x.filename}`).join(", ")}` : "multipart/form-data";
    } else if (r.body) info = esc(r.body).slice(0, 160);
    if (r.json && typeof r.json === "object") {
      const j = Array.isArray(r.json) ? `[${r.json.length} รายการ]` : JSON.stringify({ ...r.json, token: r.json.token ? "…" : undefined, content: r.json.content ? `[${r.json.content.length} รายการ]` : undefined }).slice(0, 170);
      info += (info ? "<br>" : "") + "→ " + esc(j);
    }
    const st = r.failed ? `<b class=bad>${esc(r.failed)}</b>` : r.status == null ? "-" : `<b class=${r.status < 400 ? "good" : "warn"}>${r.status}</b>`;
    return `<tr><td>${r.method}</td><td class=mono>${esc(r.path)}</td><td>${st}</td><td>${r.auth ? "Bearer ✓" : "–"}</td><td class=small>${info}</td></tr>`;
  }).join("");
  const checks = rec.checks.map((c) => `<li class=${c.ok ? "good" : "bad"}>${c.ok ? "✓" : "✗"} ${esc(c.name)}${c.detail ? ` <span class=small>— ${esc(c.detail)}</span>` : ""}</li>`).join("");
  const label = { pass: "ผ่าน", fail: "ไม่ผ่าน", skip: "รันไม่ได้", manual: "ให้คนตรวจ" }[rec.status];
  const html = `<!doctype html><meta charset=utf-8><style>
    body{margin:0;font-family:Sarabun,"Leelawadee UI",Tahoma,sans-serif;background:#f3f5f7;color:#16202a}
    .wrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;padding:16px;width:1700px;box-sizing:border-box}
    .shot{background:#fff;border:1px solid #d0d7de;border-radius:8px;overflow:hidden}.shot img{width:100%;display:block}
    .panel{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:14px 16px}
    h1{font-size:22px;margin:0 0 4px}.tag{display:inline-block;padding:2px 10px;border-radius:99px;font-size:14px;color:#fff}
    .pass{background:#15803d}.fail{background:#b91c1c}.skip{background:#6b7280}.manual{background:#7c3aed}
    h2{font-size:15px;margin:14px 0 6px;color:#475569}table{border-collapse:collapse;width:100%;font-size:13px}
    table{table-layout:fixed}td,th{border-bottom:1px solid #e5e7eb;padding:4px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f8fafc}th:nth-child(1){width:58px}th:nth-child(2){width:31%}th:nth-child(3){width:62px}th:nth-child(4){width:62px}
    .mono{font-family:Consolas,monospace}.small{font-size:12px;color:#475569}ul{margin:0;padding-left:0;list-style:none;font-size:14px}
    li{margin:3px 0}.good{color:#15803d}.bad{color:#b91c1c}.warn{color:#b45309}.meta{font-size:12px;color:#64748b}
  </style><div class=wrap><div class=shot>${shot ? `<img src="data:image/png;base64,${shot.toString("base64")}">` : "<p style='padding:16px'>ไม่มีภาพหน้าเว็บ</p>"}</div>
  <div class=panel><h1>${esc(rec.id)} <span class="tag ${rec.status}">${label}</span></h1><div>Expected: ${esc(rec.title)}</div>
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
const calls = (rec, method, re) => rec.requests.filter((r) => r.method === method && re.test(r.path.split("?")[0]));
const lastJson = (rec, method, re) => calls(rec, method, re).filter((r) => r.json).at(-1)?.json;

async function login(page, user) {
  await page.goto(UI + "/pages/login.html");
  await page.fill("#username", user);
  await page.fill("#password", PASSWORD);
  const [res] = await Promise.all([
    page.waitForResponse((r) => isApi(r, "POST", "/api/auth/login"), { timeout: 15000 }),
    page.click("#login-btn"),
  ]);
  if (res.status() !== 200) throw new Error(`login ${user} ไม่สำเร็จ (${res.status()})`);
  await page.waitForURL(HOME[ROLE(user)], { timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

// ---- เจ้าหน้าที่: รายการคำร้อง
async function waitList(page) {
  await page.waitForFunction(() => {
    const l = document.getElementById("loading-state");
    return l && l.classList.contains("is-hidden");
  }, null, { timeout: 15000 });
  await sleep(150);
}
async function openList(page, query = "") {
  await page.goto(`${UI}/pages/staff-requests.html${query}`);
  await waitList(page);
}
async function listedIds(page) {
  return page.evaluate(() => {
    if (!document.getElementById("empty-state")?.classList.contains("is-hidden")) return [];
    const desk = window.matchMedia("(min-width: 1024px)").matches;
    const nodes = desk
      ? [...document.querySelectorAll('#request-table-body [data-field="code"]')]
      : [...document.querySelectorAll('#request-list [data-field="meta"]')];
    return nodes.map((n) => Number((n.textContent.match(/#(\d+)/) || [])[1])).filter(Boolean);
  });
}
async function search(page, q) {
  await page.fill("#search-input", q);
  await sleep(700);
  await waitList(page);
}
async function chip(page, status) {
  const c = page.locator(`#status-filter [data-status="${status}"]`);
  if (await c.evaluate((el) => el.classList.contains("is-active"))) return;
  await c.click();
  await waitList(page);
}
async function emptyShown(page) { return shown(page, "#empty-state"); }

// ---- เจ้าหน้าที่: รายละเอียดคำร้อง
async function openDetail(page, id, extra = "") {
  await page.goto(`${UI}/pages/staff-request-detail.html?id=${id}${extra}`);
  await waitDetail(page);
}
async function waitDetail(page) {
  await page.waitForFunction(() => {
    const l = document.getElementById("detail-loading");
    return l && l.classList.contains("is-hidden");
  }, null, { timeout: 15000 });
  await waitTech(page);
}
async function waitTech(page) {
  await page.waitForFunction(() => {
    const f = document.getElementById("assign-form");
    if (!f || f.classList.contains("is-hidden")) return true;
    const t = document.getElementById("tech-loading");
    return t && t.classList.contains("is-hidden");
  }, null, { timeout: 15000 });
  await sleep(150);
}
const radio = (name, value) => `input[name="${name}"][value="${value}"]`;
async function pick(page, name, value) {
  await page.locator(radio(name, value)).check({ force: true });
  if (name === "slot") await waitTech(page);
  await sleep(100);
}
async function isChecked(page, name, value) { return page.locator(radio(name, value)).isChecked(); }
async function cardSelected(page, name, value) {
  return page.locator(radio(name, value)).evaluate((i) => i.closest(".choice")?.classList.contains("is-selected") || false);
}
async function customAppt(page, { date, period = "MORNING", note } = {}) {
  await pick(page, "slot", "CUSTOM");
  if (date !== undefined) { await page.fill("#custom-date", date); await page.dispatchEvent("#custom-date", "change"); }
  await page.selectOption("#custom-period", period);
  if (note !== undefined) await page.fill("#custom-note", note);
  await sleep(450);
  await waitTech(page);
}
async function techTag(page, techId) {
  return page.locator(radio("technician", String(techId))).evaluate((i) => {
    const tag = i.closest(".choice")?.querySelector(".choice__tag");
    if (!tag) return "";
    const long = tag.querySelector(".only-desktop");
    return (long ? long.textContent : tag.textContent).trim();
  });
}
async function submitAssign(page) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => isApi(r, "PUT", /\/assign$/), { timeout: 15000 }),
    page.click("#assign-btn"),
  ]);
  await page.waitForFunction(() => !document.getElementById("success-view")?.classList.contains("is-hidden")
    || !document.getElementById("submit-error")?.classList.contains("is-hidden"), null, { timeout: 10000 }).catch(() => {});
  await sleep(200);
  return res;
}
async function successRows(page) {
  return page.$$eval("#success-rows .success-card__row", (rows) => Object.fromEntries(rows.map((r) => [r.querySelector("dt")?.textContent.trim(), r.querySelector("dd")?.textContent.trim()])));
}
async function fieldError(page, id) {
  const vis = await shown(page, `#${id}`);
  return vis ? (await text(page, `#${id}`)) || "" : "";
}
async function clickBackToList(page) {
  await Promise.all([page.waitForURL(/staff-requests\.html/, { timeout: 10000 }), page.click("#back-link")]);
  await waitList(page);
}

// ---- ช่าง
async function waitTasks(page) {
  await page.waitForFunction(() => !/กำลังโหลด/.test(document.getElementById("api-notice")?.textContent || "กำลังโหลด"), null, { timeout: 15000 });
  await sleep(150);
}
async function taskCardIds(page) {
  return page.$$eval(".tech-task", (cards) => cards.map((c) => Number((c.getAttribute("href").match(/id=(\d+)/) || [])[1])).filter(Boolean));
}
async function waitNotice(page, sel = ".tech-notice") {
  await page.waitForFunction((s) => !/กำลังโหลด/.test(document.querySelector(s)?.textContent || "กำลังโหลด"), sel, { timeout: 15000 });
  await sleep(150);
}
async function openSubmit(page, id) {
  await page.goto(`${UI}/pages/technician-submit.html?id=${id}`);
  await page.waitForFunction(() => document.getElementById("job-loading")?.classList.contains("is-hidden")
    || !document.getElementById("page-error")?.classList.contains("is-hidden"), null, { timeout: 15000 });
  await sleep(150);
}
async function submitHandover(page) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => isApi(r, "POST", /\/complete$/), { timeout: 20000 }),
    page.click("#submit-btn"),
  ]);
  await sleep(400);
  return res;
}
const setFiles = (page, names) => page.setInputFiles("#images", names.map(fx));
async function noHorizontalScroll(page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    return { ok: document.documentElement.scrollWidth <= w + 1, scroll: document.documentElement.scrollWidth, client: w };
  });
}

// ---------------------------------------------------------------- ข้อมูลทดสอบที่สคริปต์สร้างเพิ่ม (ผ่าน API ของผู้พักอาศัย)
const R = {}; // R.r1 … R.r5 = เลขคำร้องที่สร้างได้จริง
const NEW_REQUESTS = {
  r1: { user: "resident01", locationType: "ROOM", building: "อาคาร A", locationDetail: "ชั้น 3 · ห้อง 305", category: "ELECTRICAL", title: "ปลั๊กไฟหัวเตียงไม่มีไฟ",
    description: "ปลั๊กไฟข้างหัวเตียงเสียบแล้วไม่มีไฟ ลองหลายเครื่องแล้ว (Task53)", d1: 3, s1: "MORNING", d2: 4, s2: "AFTERNOON", urgency: "NORMAL", images: ["ok1.jpg", "ok2.jpg"] },
  r2: { user: "resident02", locationType: "ROOM", building: "อาคาร B", locationDetail: "ชั้น 2 · ห้อง 210", category: "PLUMBING", title: "ฝักบัวน้ำไหลอ่อน",
    description: "ฝักบัวในห้องน้ำน้ำไหลอ่อนมาก (Task53)", d1: 3, s1: "AFTERNOON", urgency: "URGENT", images: ["ok3.jpg"] },
  r3: { user: "resident01", locationType: "COMMON_AREA", building: "อาคาร A", locationDetail: "ชั้น 2 · ทางเดิน", category: "ELECTRICAL", title: "ไฟทางเดินกะพริบ",
    description: "หลอดไฟทางเดินชั้น 2 กะพริบตลอดเวลา (Task53)", d1: 5, s1: "MORNING", urgency: "NORMAL", images: ["ok1.jpg"] },
  r4: { user: "resident02", locationType: "ROOM", building: "อาคาร B", locationDetail: "ชั้น 2 · ห้อง 210", category: "ELECTRICAL", title: "สวิตช์ไฟหลวม",
    description: "สวิตช์ไฟหน้าห้องหลวม กดแล้วไม่ติดบางครั้ง (Task53)", d1: 5, s1: "AFTERNOON", urgency: "NORMAL", images: ["ok2.jpg"] },
  r5: { user: "resident01", locationType: "ROOM", building: "อาคาร A", locationDetail: "ชั้น 3 · ห้อง 305", category: "ELECTRICAL", title: "พัดลมเพดานไม่หมุน",
    description: "พัดลมเพดานเปิดแล้วไม่หมุน มีเสียงหึ่ง (Task53)", d1: 6, s1: "MORNING", urgency: "NORMAL", images: ["ok3.jpg"] },
};
async function createRequests() {
  for (const [key, s] of Object.entries(NEW_REQUESTS)) {
    const fd = new FormData();
    const add = (k, v) => { if (v !== undefined && v !== null) fd.append(k, v); };
    add("locationType", s.locationType); add("building", s.building); add("locationDetail", s.locationDetail);
    add("category", s.category); add("title", s.title); add("description", s.description);
    add("preferredDate1", D(s.d1)); add("preferredSlot1", s.s1);
    if (s.d2) { add("preferredDate2", D(s.d2)); add("preferredSlot2", s.s2); }
    add("contactPhone", s.user === "resident01" ? "081-234-5678" : "082-345-6789"); add("lineId", "");
    add("urgency", s.urgency);
    for (const f of s.images) fd.append("images", new Blob([await fs.readFile(fx(f))], { type: "image/jpeg" }), f);
    const r = await apiJson("POST", "/api/repair-requests", { user: s.user, body: fd });
    if (r.status !== 201 && r.status !== 200) throw new Error(`สร้างคำร้องทดสอบ ${key} ไม่สำเร็จ (${r.status}) ${r.data?.message || ""}`);
    R[key] = r.data.requestId;
  }
  console.log(`\nสร้างคำร้องทดสอบผ่าน API: ${Object.entries(R).map(([k, v]) => `${k}=#${v}`).join(", ")}\n`);
}

// ================================================================ PHASE A: ข้อมูลตั้งต้นเท่านั้น (ไม่เปลี่ยนสถานะคำร้อง)
async function staffListCases() {
  await runCase("UI-U4-011", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await chip(page, "IN_PROGRESS");
    await search(page, "1019");
    const a = await listedIds(page);
    check("ตัวกรองกำลังดำเนินการ + คำค้น 1019 แสดงเฉพาะ #1019", a.length === 1 && a[0] === 1019, `แสดง ${a.join(", ") || "ไม่มี"}`);
    await search(page, "1003");
    const b = await listedIds(page);
    const empty = await emptyShown(page);
    check("คงตัวกรองไว้แล้วค้น 1003 แสดง \"ไม่พบคำร้อง\"", b.length === 0 && empty, `แสดง ${b.join(", ") || "ไม่มี"} · empty-state ${empty ? "แสดง" : "ไม่แสดง"}`);
    actual(`กำลังดำเนินการ+1019 → ${a.map((x) => "#" + x).join(", ") || "ไม่มี"} · กำลังดำเนินการ+1003 → ${empty ? "ไม่พบคำร้อง" : b.join(", ")}`);
  });

  await runCase("UI-U4-012", async ({ page, check, actual }) => {
    await login(page, "staff01");
    const all = (await staffAll()).map((r) => r.requestId);
    const p1 = await listedIds(page);
    await page.click("#next-page-btn"); await waitList(page);
    const p2 = await listedIds(page);
    await page.click("#previous-page-btn"); await waitList(page);
    const back = await listedIds(page);
    const union = [...p1, ...p2];
    check("หน้า 1 มี 5 รายการ (มือถือหน้าละ 5)", p1.length === 5, p1.length);
    check(`หน้า 2 มี ${all.length - 5} รายการ`, p2.length === all.length - 5, p2.length);
    check("ไม่มีเลขซ้ำ และรวม 2 หน้าครบตาม API", new Set(union).size === union.length && union.length === all.length && all.every((x) => union.includes(x)), `API ${all.join(",")} / UI ${union.join(",")}`);
    check("กดก่อนหน้าแล้วกลับมาเป็นชุดเดิม", JSON.stringify(back) === JSON.stringify(p1));
    actual(`หน้า 1: ${p1.map((x) => "#" + x).join(" ")} · หน้า 2: ${p2.map((x) => "#" + x).join(" ")} · ไม่ซ้ำ ไม่หาย เทียบกับ API ${all.length} รายการ`);
  }, { viewport: MOBILE });

  await runCase("UI-U4-013", async ({ page, check, actual }) => {
    await login(page, "staff01");
    const ids = await listedIds(page);
    const prevDis = await page.locator("#previous-page-btn").isDisabled();
    const nextDis = await page.locator("#next-page-btn").isDisabled();
    const pages = await page.$$eval("#page-list [data-page]", (b) => b.map((x) => x.textContent.trim()));
    check("แสดงทุกรายการในหน้าเดียว", ids.length === 6, ids.length);
    check("ปุ่มก่อนหน้า/ถัดไปถูกปิด", prevDis && nextDis, `prev ${prevDis} next ${nextDis}`);
    check("มีเลขหน้า 1 อย่างเดียว", pages.length === 1 && pages[0] === "1", pages.join(","));
    actual(`${ids.length} รายการในหน้าเดียว · ปุ่มก่อนหน้า/ถัดไป disabled · เลขหน้า ${pages.join(",")}`);
  });

  await runCase("UI-U4-014", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await Promise.all([page.waitForURL(/staff-request-detail\.html\?id=1021/, { timeout: 10000 }),
      page.locator("#request-table-body tr", { hasText: "#1021" }).locator('[data-field="title"]').click()]);
    await waitDetail(page);
    const api = await staffDetail(1021);
    const title = await text(page, "#req-title");
    check("เปิดรายละเอียด id=1021", /id=1021/.test(page.url()), page.url());
    check("ชื่อเรื่องตรงกับคำร้อง #1021", title === api.title, `"${title}" / API "${api.title}"`);
    actual(`คลิกแถว #1021 → ${page.url().replace(UI, "")} · ชื่อเรื่อง "${title}"`);
  });

  await runCase("UI-U4-015", async ({ page, check, actual, rec }) => {
    await login(page, "tech01");
    await page.goto(UI + "/pages/staff-requests.html");
    await page.waitForURL(/technician-tasks\.html/, { timeout: 10000 }).catch(() => {});
    await sleep(500);
    const staffCalls = calls(rec, "GET", /^\/api\/staff\/repair-requests$/);
    check("ขึ้นข้อความไม่มีสิทธิ์", rec.dialogs.some((d) => d.includes("ไม่มีสิทธิ์")), rec.dialogs.join(" / "));
    check("พากลับหน้าแรกของช่าง", /technician-tasks\.html/.test(page.url()), page.url());
    check("API รายการคำร้องไม่ส่งข้อมูลให้ช่าง (ไม่มี 200)", staffCalls.every((c) => c.status !== 200), staffCalls.map((c) => c.status).join(",") || "ไม่ได้เรียก");
    const direct = await apiJson("GET", "/api/staff/repair-requests?page=0&size=10", { user: "resident01" });
    check("เรียก API ด้วย token ผู้พักอาศัยได้ 403", direct.status === 403, direct.status);
    actual(`tech01 เปิดหน้าเจ้าหน้าที่ → alert "${rec.dialogs[0] || "-"}" แล้วไป ${page.url().replace(UI, "")} · API ด้วย token ผู้พักอาศัย → ${direct.status}`);
  });

  await runCase("UI-U4-016", async ({ page, check, actual }) => {
    let block = true;
    await page.route((u) => u.href.startsWith(API + "/api/staff/repair-requests"), (r) => (block ? r.abort("internetdisconnected") : r.continue()));
    await login(page, "staff01").catch(() => {});
    await page.waitForFunction(() => !document.getElementById("error-state")?.classList.contains("is-hidden"), null, { timeout: 10000 }).catch(() => {});
    const err = await shown(page, "#error-state");
    const msg = (await text(page, "#error-message")) || "";
    const retry = await shown(page, "#retry-btn");
    const ids = await listedIds(page).catch(() => []);
    check("แสดงกล่องข้อความโหลดไม่สำเร็จ", err && msg.includes("ไม่สามารถโหลดรายการคำร้องได้"), msg);
    check("มีปุ่มลองใหม่", retry);
    check("ไม่แสดงรายการปลอม", ids.length === 0 || !(await shown(page, "#request-table-wrap")));
    block = false;
    await page.click("#retry-btn");
    await waitList(page);
    const after = await listedIds(page);
    check("กดลองใหม่หลังเชื่อมต่อได้ รายการกลับมา", after.length > 0, after.length);
    actual(`ตัดการเชื่อมต่อ → "${short(msg, 70)}" + ปุ่มลองใหม่ · กดลองใหม่ → แสดง ${after.length} รายการ`);
  });

  await runCase("UI-FIG-U4-02", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await search(page, "มานี");
    const ids = await listedIds(page);
    const api = (await staffAll()).filter((r) => (r.reporterName || "").includes("มานี")).map((r) => r.requestId);
    check("แสดงเฉพาะคำร้องของมานี มีสุข", ids.length === api.length && api.every((x) => ids.includes(x)), `UI ${ids.join(",")} / API ${api.join(",")}`);
    actual(`ค้น "มานี" → ${ids.map((x) => "#" + x).join(", ")}`);
  });

  await runCase("UI-FIG-U4-03", async ({ page, check, actual }) => {
    await login(page, "staff01");
    const all = await staffAll();
    const out = [];
    for (const st of ["PENDING", "IN_PROGRESS", "COMPLETED", "ALL"]) {
      await chip(page, st);
      const ids = await listedIds(page);
      const expect = all.filter((r) => st === "ALL" || r.status === st).map((r) => r.requestId);
      const c = page.locator(`#status-filter [data-status="${st}"]`);
      const active = await c.evaluate((el) => el.classList.contains("is-active") && el.getAttribute("aria-pressed") === "true");
      const n = Number(await c.locator('[data-field="count"]').innerText());
      check(`${st}: แสดงเฉพาะสถานะนี้`, ids.length === expect.length && expect.every((x) => ids.includes(x)), `UI ${ids.join(",")} / API ${expect.join(",")}`);
      check(`${st}: ปุ่มที่เลือกเป็น active`, active);
      check(`${st}: ตัวเลขบนปุ่ม = จำนวนที่แสดง`, n === ids.length, `${n} / ${ids.length}`);
      out.push(`${st} ${ids.length}`);
    }
    actual(`จำนวนต่อตัวกรอง: ${out.join(" · ")} ตรงกับ API และตัวเลขบนปุ่ม`);
  });
}

async function staffDetailReadCases() {
  await runCase("UI-U5-001", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    const title = await text(page, "#req-title");
    const api = await staffDetail(1024);
    const opts = await page.$$eval('input[name="urgency"]', (i) => i.map((x) => x.value));
    check("แสดงรายละเอียด #1024", title === api.title, title);
    check("การ์ดความเร่งด่วนมีตัวเลือก ปกติ / เร่งด่วน", await shown(page, "#urgency-options") && opts.join(",") === "NORMAL,URGENT", opts.join(","));
    actual(`#1024 "${title}" · การ์ดความเร่งด่วน ${opts.join(" / ")}`);
  });

  await runCase("UI-U5-002", async ({ shot }) => {
    await shotDetailPair("UI-U5-002", 1024, shot);
  });

  await runCase("UI-U5-003", async ({ page, check, actual }) => {
    await login(page, "staff01");
    const out = [];
    for (const id of [1024, 1021]) {
      await openDetail(page, id);
      const api = await staffDetail(id);
      const title = await text(page, "#req-title");
      const meta = await text(page, "#req-meta");
      const loc = await text(page, "#fact-location");
      const cat = await text(page, "#fact-category");
      check(`#${id} ชื่อเรื่องตรง`, title === api.title, title);
      check(`#${id} ผู้แจ้งตรง`, (meta || "").includes(api.reporterName), meta);
      check(`#${id} สถานที่ตรง`, (loc || "").includes(api.locationDetail.split("·").pop().trim()), loc);
      check(`#${id} ประเภทแสดงค่า`, !!cat && cat !== "-", cat);
      out.push(`#${id} "${title}" · ${api.reporterName}`);
    }
    actual(out.join(" / ") + " · ไม่มีข้อมูลปนกัน");
  });

  await runCase("UI-U5-004", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    await pick(page, "urgency", "URGENT");
    const u = await isChecked(page, "urgency", "URGENT");
    const n = await isChecked(page, "urgency", "NORMAL");
    const sel = await cardSelected(page, "urgency", "URGENT");
    check("เร่งด่วนถูกเลือก", u); check("ปกติไม่ถูกเลือก", !n); check("การ์ดเร่งด่วนมีกรอบเลือก (is-selected)", sel);
    actual(`เลือกเร่งด่วน → URGENT checked, NORMAL unchecked, การ์ด is-selected`);
  });

  await runCase("UI-U5-005", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    await pick(page, "urgency", "URGENT");
    await pick(page, "urgency", "NORMAL");
    check("ปกติถูกเลือก", await isChecked(page, "urgency", "NORMAL"));
    check("เร่งด่วนไม่ถูกเลือก และไม่มีกรอบเลือก", !(await isChecked(page, "urgency", "URGENT")) && !(await cardSelected(page, "urgency", "URGENT")));
    actual("เปลี่ยนเร่งด่วน → ปกติ: ปกติ checked, เร่งด่วน unchecked");
  });

  await runCase("UI-U5-006", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    const checked = await page.$$eval('input[name="urgency"]', (i) => i.filter((x) => x.checked).map((x) => x.value));
    const hint = (await text(page, "#urgency-hint")) || "";
    check("มีตัวเลือกถูกเลือกไว้ 1 ค่า", checked.length === 1, checked.join(","));
    check("ค่าเริ่มต้นของ #1024 = ปกติ (ผู้แจ้งไม่ได้ติ๊กเร่งด่วน)", checked[0] === "NORMAL", checked[0]);
    check("ข้อความบอกว่าผู้แจ้งไม่ได้ระบุว่าเร่งด่วน", hint.includes("ไม่ได้ระบุ"), hint);
    actual(`ค่าเริ่มต้น ${checked[0]} · "${hint}"`);
  });

  for (const [id, how] of [["UI-U5-009", "link"], ["UI-U5-013", "button"], ["UI-FIG-U5-02", "button"]]) {
    await runCase(id, async ({ page, check, actual, rec }) => {
      await login(page, "staff01");
      await openDetail(page, 1024);
      await pick(page, "urgency", "URGENT");
      if (how === "link") await clickBackToList(page);
      else { await Promise.all([page.waitForURL(/staff-requests\.html/), page.locator("#action-bar .js-list-link").click()]); await waitList(page); }
      await openDetail(page, 1024);
      const api = await staffDetail(1024);
      check("ไม่มี PUT ไป API", calls(rec, "PUT", /\/assign$/).length === 0);
      check("เปิดอีกครั้งยังเป็นปกติ", await isChecked(page, "urgency", "NORMAL"));
      check("API ตอบ urgency = NORMAL", api.urgency === "NORMAL", api.urgency);
      actual(`เปลี่ยนเป็นเร่งด่วนแล้วกด${how === "link" ? "ลิงก์ ‹ กลับไปรายการคำร้อง" : "ปุ่มกลับไปรายการ"} → ไม่มี PUT · เปิดใหม่เป็นปกติ · API urgency ${api.urgency}`);
    });
  }

  await runCase("UI-U5-012", async ({ page, check, actual, rec }) => {
    await login(page, "tech01");
    await page.goto(UI + "/pages/staff-request-detail.html?id=1024");
    await page.waitForURL(/technician-tasks\.html/, { timeout: 10000 }).catch(() => {});
    const put = await apiJson("PUT", "/api/staff/repair-requests/1024/assign", { user: "tech01", body: { technicianId: 5, urgency: "URGENT", appointmentDate: D(3), appointmentSlot: "MORNING", appointmentNote: "ทดสอบสิทธิ์" } });
    const api = await staffDetail(1024);
    check("หน้าเว็บพากลับหน้าแรกของช่าง", /technician-tasks\.html/.test(page.url()), page.url());
    check("ขึ้นข้อความไม่มีสิทธิ์", rec.dialogs.some((d) => d.includes("ไม่มีสิทธิ์")));
    check("PUT /assign ด้วย token ช่างได้ 403", put.status === 403, put.status);
    check("คำร้องไม่เปลี่ยน (ยัง PENDING / NORMAL)", api.status === "PENDING" && api.urgency === "NORMAL", `${api.status} / ${api.urgency}`);
    actual(`tech01 → พากลับ ${page.url().replace(UI, "")} · PUT /assign = ${put.status} · #1024 ยัง ${api.status}`);
  });

  await runCase("UI-U6-001", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    const cards = await page.$$eval("#slot-options .choice__title", (t) => t.map((x) => x.textContent.trim()));
    const hiddenBefore = !(await shown(page, "#custom-appt"));
    await pick(page, "slot", "CUSTOM");
    const fields = await Promise.all(["#custom-date", "#custom-period", "#custom-note"].map((s) => shown(page, s)));
    check("แสดงช่วงที่ผู้แจ้งเสนอ + กำหนดวันนัดใหม่", cards.length >= 2 && cards.some((c) => c.startsWith("ช่วงที่ 1")) && cards.at(-1) === "กำหนดวันนัดใหม่", cards.join(" | "));
    check("ช่องกำหนดใหม่ซ่อนก่อนเลือก", hiddenBefore);
    check("เลือกกำหนดใหม่แล้วมีช่องวันที่ ช่วงเวลา หมายเหตุ", fields.every(Boolean), fields.join(","));
    actual(`ตัวเลือก: ${cards.join(" | ")} · เลือกกำหนดใหม่ → แสดงวันที่/ช่วงเวลา/หมายเหตุ`);
  });

  await runCase("UI-U6-002", async ({ page, shot }) => {
    for (const [name, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
      const s = await newSession(vp);
      await login(s.page, "staff01");
      await openDetail(s.page, 1024);
      await customAppt(s.page, { date: D(7), period: "AFTERNOON", note: "โทรตกลงกับผู้แจ้งแล้ว" });
      await shot(name, s.page);
      await s.ctx.close();
    }
  });

  await runCase("UI-U6-005", async (t) => pastDateCase(t, "UI-U6-005"));
  await runCase("UI-FIG-U6-03", async (t) => pastDateCase(t, "UI-FIG-U6-03"));

  await runCase("UI-U6-006", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    const before = calls(rec, "GET", /\/api\/staff\/technicians$/).length;
    await customAppt(page, { date: D(7), period: "MORNING" });
    const hint = (await text(page, "#tech-hint")) || "";
    const techCalls = calls(rec, "GET", /\/api\/staff\/technicians$/);
    const last = techCalls.at(-1);
    check("ไม่มีข้อความผิดพลาดที่ช่องวันที่", !(await fieldError(page, "custom-date-error")));
    check("ข้อความสถานะคิวช่างแสดงวันที่แบบไทย", hint.includes(thShort(D(7))), `"${hint}" ควรมี ${thShort(D(7))}`);
    check("โหลดรายชื่อช่างใหม่ด้วยวันที่นั้น", techCalls.length > before && last && last.path.includes(`date=${D(7)}`) && last.path.includes("slot=MORNING"), last?.path);
    actual(`กำหนดใหม่ ${D(7)} ช่วงเช้า → "${short(hint, 60)}" · GET ${last?.path}`);
  });

  await runCase("UI-U6-007", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    const opts = await page.$$eval("#custom-period option", (o) => o.map((x) => `${x.value}=${x.textContent.trim()}`));
    const desc = await page.$$eval("#slot-options .choice__desc", (d) => d.map((x) => x.textContent.trim()));
    check("ช่วงเวลามี 2 ค่าและเวลาถูกต้อง", opts.join("|") === "MORNING=ช่วงเช้า 09:00–12:00 น.|AFTERNOON=ช่วงบ่าย 13:00–16:00 น.", opts.join(" | "));
    check("การ์ดช่วงที่ 1 ของ #1024 แสดงช่วงเช้า 09:00–12:00 น.", (desc[0] || "").includes("ช่วงเช้า 09:00–12:00 น."), desc[0]);
    actual(`ตัวเลือก ${opts.join(" / ")} · ช่วงที่ 1: ${desc[0]}`);
  });

  await runCase("UI-U6-008", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    await page.click("#assign-btn"); await sleep(200); // ให้ข้อความเตือนขึ้นก่อน
    const errBefore = await fieldError(page, "tech-select-error");
    await pick(page, "technician", 5);
    check("tech01 ถูกเลือก", await isChecked(page, "technician", 5));
    check("การ์ด tech01 มีกรอบเลือก", await cardSelected(page, "technician", 5));
    check("ข้อความเตือนให้เลือกช่างหายไป", !!errBefore && !(await fieldError(page, "tech-select-error")), `ก่อนเลือก "${errBefore}"`);
    const name = await page.locator(radio("technician", 5)).evaluate((i) => i.closest(".choice").querySelector(".choice__title").textContent);
    actual(`เลือก ${name} → checked + is-selected · ข้อความเตือนหาย`);
  });

  await runCase("UI-U6-009", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    await pick(page, "technician", 5);
    await pick(page, "technician", 6);
    check("tech02 ถูกเลือก", await isChecked(page, "technician", 6) && await cardSelected(page, "technician", 6));
    check("tech01 ไม่ถูกเลือก", !(await isChecked(page, "technician", 5)) && !(await cardSelected(page, "technician", 5)));
    actual("เลือก tech01 แล้วเปลี่ยนเป็น tech02 → เหลือ tech02 ถูกเลือกคนเดียว");
  });

  for (const id of ["UI-U6-010", "UI-FIG-U6-04"]) {
    await runCase(id, async ({ page, check, actual, rec }) => {
      await login(page, "staff01");
      await openDetail(page, 1021);
      const data = lastJson(rec, "GET", /\/api\/staff\/technicians$/) || [];
      const t3 = await techTag(page, 7);
      const t4 = await techTag(page, 8);
      const c3 = data.find((x) => x.id === 7)?.appointmentCount;
      const c4 = data.find((x) => x.id === 8)?.appointmentCount;
      const disabled = await page.locator(radio("technician", 7)).isDisabled();
      await pick(page, "technician", 7);
      check(`tech03 ขึ้น "มีนัดแล้ว ${c3} งาน" ตาม API`, c3 === 2 && t3 === `มีนัดแล้ว ${c3} งาน`, `ป้าย "${t3}" · API ${c3}`);
      check("tech04 ขึ้น \"ว่าง\"", c4 === 0 && t4 === "ว่าง", `ป้าย "${t4}" · API ${c4}`);
      check("เลือก tech03 ได้ (ไม่ถูกปิด)", !disabled && await isChecked(page, "technician", 7));
      check("ไม่มี PUT (แค่เลือก ยังไม่มอบหมาย)", calls(rec, "PUT", /\/assign$/).length === 0);
      actual(`#1021 ช่วงบ่าย 30/11/2569: tech03 "${t3}" · tech04 "${t4}" · เลือก tech03 ได้`);
    });
  }

  await runCase("UI-U6-011", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    await pick(page, "technician", 5);
    await customAppt(page, { note: "โทรตกลงแล้ว" });
    await page.click("#assign-btn"); await sleep(400);
    const msg = await fieldError(page, "custom-date-error");
    check("ขึ้น \"กรุณาระบุวันนัดหมาย\"", msg.includes("กรุณาระบุวันนัดหมาย"), msg);
    check("ไม่มี PUT ไป API", calls(rec, "PUT", /\/assign$/).length === 0);
    actual(`เว้นวันนัด → "${msg}" · ไม่มี PUT`);
  });

  await runCase("UI-U6-012", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    await page.click("#assign-btn"); await sleep(400);
    const msg = await fieldError(page, "tech-select-error");
    check("ขึ้น \"กรุณาเลือกช่างผู้รับผิดชอบ\"", msg.includes("กรุณาเลือกช่างผู้รับผิดชอบ"), msg);
    check("ไม่มี PUT ไป API", calls(rec, "PUT", /\/assign$/).length === 0);
    actual(`ไม่เลือกช่าง → "${msg}" · ไม่มี PUT`);
  });

  for (const id of ["UI-U6-013", "UI-FIG-U6-02"]) {
    await runCase(id, async ({ page, check, actual, rec }) => {
      await login(page, "staff01");
      await openDetail(page, 1024);
      await pick(page, "technician", 5);
      await customAppt(page, { date: D(7), note: "" });
      await page.click("#assign-btn"); await sleep(400);
      const msg = await fieldError(page, "custom-note-error");
      check("ขึ้น \"กรุณาระบุเหตุผล/หมายเหตุที่เลื่อนวันนัด\"", msg.includes("กรุณาระบุเหตุผล/หมายเหตุ"), msg);
      check("ไม่มี PUT ไป API", calls(rec, "PUT", /\/assign$/).length === 0);
      actual(`กำหนดใหม่ไม่ใส่หมายเหตุ → "${msg}" · ไม่มี PUT`);
    });
  }

  await runCase("UI-U6-020", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    await pick(page, "technician", 5);
    await customAppt(page, { note: "" });
    await page.click("#assign-btn"); await sleep(400);
    const d = await fieldError(page, "custom-date-error");
    const n = await fieldError(page, "custom-note-error");
    const red = await page.evaluate(() => ["custom-date", "custom-note"].map((i) => document.getElementById(i).classList.contains("is-invalid")));
    check("ข้อความใต้ช่องวันที่และหมายเหตุขึ้นพร้อมกัน", !!d && !!n, `"${d}" / "${n}"`);
    check("ทั้งสองช่องมีกรอบแดง (is-invalid)", red.every(Boolean), red.join(","));
    check("ไม่มี PUT ไป API", calls(rec, "PUT", /\/assign$/).length === 0);
    await page.fill("#custom-date", D(7)); await page.dispatchEvent("#custom-date", "change");
    await page.fill("#custom-note", "โทรตกลงแล้ว"); await sleep(300);
    const d2 = await fieldError(page, "custom-date-error");
    const n2 = await fieldError(page, "custom-note-error");
    check("กรอกครบแล้วข้อความหายไป", !d2 && !n2, `"${d2}" / "${n2}"`);
    actual(`เว้นวันที่+หมายเหตุ → "${d}" / "${n}" กรอบแดงทั้งคู่ · ไม่มี PUT · กรอกแล้วข้อความหาย`);
  });

  await runCase("UI-U5-010", async (t) => assignNetworkError(t));
  await runCase("UI-U6-017", async (t) => assignNetworkError(t, true));

  await runCase("UI-U6-018", async ({ page, check, actual }) => {
    await login(page, "resident01");
    await page.goto(UI + "/pages/staff-request-detail.html?id=1024");
    await page.waitForURL(/home\.html/, { timeout: 10000 }).catch(() => {});
    const put = await apiJson("PUT", "/api/staff/repair-requests/1024/assign", { user: "resident01", body: { technicianId: 5, urgency: "NORMAL", appointmentDate: D(3), appointmentSlot: "MORNING", appointmentNote: "x" } });
    check("หน้าเว็บพากลับหน้าแรกของผู้พักอาศัย", /home\.html/.test(page.url()), page.url());
    check("PUT /assign ด้วย token ผู้พักอาศัยได้ 403", put.status === 403, put.status);
    actual(`resident01 → พากลับ ${page.url().replace(UI, "")} · PUT /assign = ${put.status}`);
  });

  await runCase("UI-U6-019", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1019);
    const facts = (await text(page, "#assigned-facts")) || "";
    check("ไม่มีฟอร์มมอบหมาย", !(await shown(page, "#assign-form")));
    check("มีแถบอ่านอย่างเดียว", await shown(page, "#readonly-banner"));
    check("แสดงช่าง ชาญชัย ท่อน้ำดี", facts.includes("ชาญชัย ท่อน้ำดี"), short(facts, 120));
    check("วันนัด 30 พ.ย. 2569 ช่วงบ่าย 13:00–16:00 น.", facts.includes("30 พ.ย. 2569") && facts.includes("ช่วงบ่าย 13:00–16:00 น."), short(facts, 160));
    actual(`#1019 อ่านอย่างเดียว · ${short(facts.replace(/\n+/g, " · "), 110)}`);
  });

  await runCase("UI-COMMON-006", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1019);
    await openDetail(page, 1003);
    const api = await staffDetail(1003);
    const title = await text(page, "#req-title");
    const facts = (await text(page, "#assigned-facts")) || "";
    const photos = await page.$$eval("#photo-grid img", (i) => i.map((x) => x.getAttribute("src") || ""));
    check("ชื่อเรื่องเป็นของ #1003", title === api.title, title);
    check("ช่างเป็นของ #1003 (ไม่มีชื่อช่างของ #1019)", facts.includes(api.technician?.name || "-") && !facts.includes("ชาญชัย"), short(facts, 90));
    check("รูปเป็นของ #1003 เท่านั้น", photos.length > 0 && photos.every((s) => s.includes("1003")), photos.join(","));
    actual(`เปิด #1019 แล้ว #1003 → "${title}" · ช่าง ${api.technician?.name} · รูป ${photos.map((s) => s.split("/").pop()).join(",")}`);
  });

  await runCase("UI-U8-014", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1019);
    const staffFacts = (await text(page, "#assigned-facts")) || "";
    const staffAfter = await page.$$eval("img", (i) => i.filter((x) => /-after/.test(x.getAttribute("src") || "")).length);
    const s = await newSession();
    await login(s.page, "tech03");
    await s.page.goto(UI + "/pages/technician-job-detail.html?id=1019");
    await waitNotice(s.page, "#detail-api-notice");
    const techAfter = await s.page.$$eval("img", (i) => i.filter((x) => /-after/.test(x.getAttribute("src") || "")).length);
    const techHas = await s.page.locator("text=รูปหลังซ่อม").count();
    await s.ctx.close();
    check("หน้าเจ้าหน้าที่ไม่มีหัวข้อรูปหลังซ่อม", !staffFacts.includes("รูปหลังซ่อม"));
    check("ไม่มีรูปหลังซ่อมปลอมในหน้าเจ้าหน้าที่", staffAfter === 0);
    check("หน้าช่างไม่มีส่วนรูปหลังซ่อม", techHas === 0 && techAfter === 0, `ข้อความ ${techHas} · img ${techAfter}`);
    actual("#1019 (กำลังดำเนินการ) ทั้งหน้าเจ้าหน้าที่และหน้าช่างไม่มีส่วน/รูปหลังซ่อม");
  });
}

async function shotDetailPair(id, reqId, shot) {
  for (const [name, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
    const s = await newSession(vp);
    await login(s.page, "staff01");
    await openDetail(s.page, reqId);
    await shot(name, s.page);
    await s.ctx.close();
  }
}

async function pastDateCase({ page, check, actual, rec }) {
  await login(page, "staff01");
  await openDetail(page, 1024);
  const min = await page.getAttribute("#custom-date", "min");
  await pick(page, "technician", 5);
  await customAppt(page, { date: D(-1), note: "ทดสอบวันย้อนหลัง" });
  await pick(page, "technician", 5);
  const res = await submitAssign(page).catch(() => null);
  const err = (await shown(page, "#submit-error")) ? (await text(page, "#submit-error-message")) || "" : "";
  const fe = await fieldError(page, "custom-date-error");
  const api = await staffDetail(1024);
  check("ช่องวันที่ตั้ง min = วันนี้", min === D(0), `min="${min}"`);
  check("ไม่บันทึก (คำร้องยังรอรับเรื่อง)", api.status === "PENDING", api.status);
  check("แสดงข้อความว่าวันนัดต้องไม่เป็นอดีต", (err + fe).includes("อดีต"), `"${err || fe}"`);
  check("ไม่ขึ้นหน้าสำเร็จ", !(await shown(page, "#success-view")));
  actual(`min=${min} · พิมพ์ ${D(-1)} แล้วกดมอบหมาย → ${res ? `PUT ${res.status()}` : "ไม่มี PUT"} · ข้อความ "${err || fe}" · #1024 ยัง ${api.status}`);
}

async function assignNetworkError({ page, check, actual }, custom = false) {
  await page.route((u) => u.href.startsWith(API) && /\/assign$/.test(u.pathname), (r) => r.abort("internetdisconnected"));
  await login(page, "staff01");
  await openDetail(page, 1024);
  if (custom) await customAppt(page, { date: D(7), period: "MORNING", note: "โทรตกลงแล้ว" });
  await pick(page, "technician", 5);
  await page.click("#assign-btn");
  await page.waitForFunction(() => !document.getElementById("submit-error")?.classList.contains("is-hidden"), null, { timeout: 10000 }).catch(() => {});
  await sleep(300);
  const msg = (await text(page, "#submit-error-message")) || "";
  const api = await staffDetail(1024);
  check("แสดงกล่องแดง #submit-error", await shown(page, "#submit-error") && msg.length > 0, msg);
  check("ไม่ขึ้นหน้าสำเร็จ", !(await shown(page, "#success-view")));
  check("ปุ่มกดได้อีกครั้ง", await page.locator("#assign-btn").isEnabled());
  check("คำร้องยังเป็นรอรับเรื่อง", api.status === "PENDING", api.status);
  actual(`ตัดการเชื่อมต่อ PUT → "${msg}" · ไม่ขึ้นหน้าสำเร็จ · ปุ่มกดได้ · #1024 ${api.status}`);
}

async function techReadCases() {
  await runCase("UI-U7-001", async ({ page, check, actual }) => {
    await login(page, "tech03");
    await waitTasks(page);
    const ids = await taskCardIds(page);
    const api = (await apiJson("GET", "/api/technician/repair-requests/assigned", { user: "tech03" })).data || [];
    const apiIds = api.map((j) => j.requestId);
    check("แสดงงานตรงกับ API ของ tech03", ids.length === apiIds.length && apiIds.every((x) => ids.includes(x)), `UI ${ids.join(",")} / API ${apiIds.join(",")}`);
    check("ไม่มีงานของช่างคนอื่น (#1003, #987)", !ids.includes(1003) && !ids.includes(987));
    actual(`tech03 เห็นงาน ${ids.map((x) => "#" + x).join(", ")} ตรงกับ API`);
  });

  await runCase("UI-U7-002", async ({ shot }) => {
    const s = await newSession();
    await login(s.page, "tech03"); await waitTasks(s.page); await shot("tasks", s.page);
    await s.page.goto(UI + "/pages/technician-job-detail.html?id=1019"); await waitNotice(s.page, "#detail-api-notice"); await shot("detail", s.page);
    await s.ctx.close();
    const m = await newSession(MOBILE);
    await login(m.page, "tech03"); await waitTasks(m.page); await shot("mobile", m.page);
    await m.ctx.close();
  });

  await runCase("UI-U7-003", async ({ page, check, actual }) => {
    await login(page, "tech03");
    await waitTasks(page);
    const api = (await apiJson("GET", "/api/technician/repair-requests/assigned", { user: "tech03" })).data || [];
    const out = [];
    for (const j of api) {
      const card = page.locator(`.tech-task[href*="id=${j.requestId}"]`);
      const txt = (await card.innerText()).replace(/\s+/g, " ");
      const group = await card.evaluate((c) => c.closest(".tech-task-list")?.id);
      const expectGroup = j.appointmentDate === D(0) || j.appointmentDate < D(0) ? "today-list" : j.appointmentDate === D(1) ? "tomorrow-list" : "upcoming-list";
      check(`#${j.requestId} แสดงเลขงาน ชื่องาน ผู้แจ้ง`, txt.includes(`#${j.requestId}`) && txt.includes(j.title) && txt.includes(j.reporterName), short(txt, 120));
      check(`#${j.requestId} อยู่กลุ่มตามวันนัด ${j.appointmentDate}`, group === expectGroup, `${group} / ควรเป็น ${expectGroup}`);
      check(`#${j.requestId} ป้ายเร่งด่วนตรงกับ API (${j.urgency})`, txt.includes("เร่งด่วน") === (j.urgency === "URGENT"));
      out.push(`#${j.requestId} ${group.replace("-list", "")}${j.urgency === "URGENT" ? " เร่งด่วน" : ""}`);
    }
    actual(`การ์ดตรงกับ API: ${out.join(" · ")}`);
  });

  await runCase("UI-U7-004", async ({ page, check, actual }) => {
    await login(page, "tech02");
    await waitTasks(page);
    const notice = (await text(page, "#api-notice")) || "";
    const ids = await taskCardIds(page);
    const empties = await page.$$eval(".tech-task-list .tech-empty", (e) => e.map((x) => x.textContent.trim()));
    check("ขึ้นข้อความยังไม่มีงานที่ได้รับมอบหมาย", notice.includes("ยังไม่มีงานที่ได้รับมอบหมาย"), notice);
    check("ไม่มีการ์ดงาน", ids.length === 0, ids.length);
    check("ทุกกลุ่มแสดงข้อความว่าง", empties.length === 3, empties.join(" / "));
    actual(`tech02 → "${notice}" · ${empties.join(" / ")}`);
  });

  await runCase("UI-U7-005", async ({ page, check, actual }) => {
    await login(page, "tech03");
    await waitTasks(page);
    await Promise.all([page.waitForURL(/technician-job-detail\.html\?id=1019/), page.click('.tech-task[href*="id=1019"]')]);
    await waitNotice(page, "#detail-api-notice");
    const api = await staffDetail(1019);
    const title = await text(page, "#detail-title");
    const loc = await text(page, "#detail-location");
    const who = await text(page, "#detail-contact-name");
    check("ชื่องานตรง", title === api.title, title);
    check("สถานที่ตรง", (loc || "").includes(api.building), loc);
    check("ผู้แจ้งตรง", who === api.reporterName, who);
    actual(`คลิก #1019 → ${page.url().replace(UI, "")} · "${title}" · ${loc} · ${who}`);
  });

  await runCase("UI-U7-006", async ({ page, check, actual }) => {
    await login(page, "tech03");
    await waitTasks(page);
    const pill = await page.locator('.tech-task[href*="id=1019"] .tech-pill.status').innerText();
    await page.goto(UI + "/pages/technician-job-detail.html?id=1019"); await waitNotice(page, "#detail-api-notice");
    const detailPill = await page.locator(".tech-task-tags .tech-pill.status").innerText();
    const s = await newSession();
    await login(s.page, "tech05");
    await s.page.goto(UI + "/pages/technician-completed.html"); await waitNotice(s.page);
    const donePill = await s.page.locator("#completed-table-body tr", { hasText: "แอร์" }).locator(".tech-pill").first().innerText().catch(() => "");
    await s.ctx.close();
    check("งานของฉัน #1019 ป้ายกำลังดำเนินการ", pill.trim() === "กำลังดำเนินการ", pill);
    check("รายละเอียด #1019 ป้ายกำลังดำเนินการ", detailPill.trim() === "กำลังดำเนินการ", detailPill);
    check("งานที่เสร็จแล้ว #1003 ป้ายเสร็จสิ้น", donePill.trim() === "เสร็จสิ้น", donePill);
    actual(`#1019 "${pill.trim()}" (รายการ/รายละเอียด) · #1003 "${donePill.trim()}"`);
  });

  await runCase("UI-U7-007", async ({ page, check, actual }) => {
    await login(page, "tech03");
    await page.goto(UI + "/pages/technician-job-detail.html?id=1019"); await waitNotice(page, "#detail-api-notice");
    const inputs = await page.$$eval("main input, main textarea, main select", (i) => i.length);
    const href = await page.getAttribute("#handover-btn", "href");
    const visible = await shown(page, "#handover-btn");
    check("ไม่มีช่องกรอกในหน้ารายละเอียด", inputs === 0, inputs);
    check("ปุ่มส่งมอบงานลิงก์ไป technician-submit.html?id=1019", visible && href === "technician-submit.html?id=1019", href);
    actual(`ช่องกรอก ${inputs} ช่อง · ปุ่มส่งมอบงาน → ${href}`);
  });

  await runCase("UI-U7-009", async ({ page, check, actual, rec }) => {
    await login(page, "tech01");
    await page.goto(UI + "/pages/technician-job-detail.html?id=1019"); await waitNotice(page, "#detail-api-notice");
    const st = calls(rec, "GET", /\/api\/staff\/repair-requests\/1019$/).at(-1)?.status;
    const notice = (await text(page, "#detail-api-notice")) || "";
    const title = await text(page, "#detail-title");
    const api = await staffDetail(1019);
    check("API ตอบ 403", st === 403, st);
    check("หน้าเว็บขึ้นข้อความโหลดไม่ได้", notice.includes("ไม่สามารถโหลด"), notice);
    check("ไม่แสดงข้อมูลของ #1019", title !== api.title, title);
    actual(`tech01 เปิด #1019 → API ${st} · "${short(notice, 70)}"`);
  });

  await runCase("UI-U7-010", async ({ page, check, actual }) => {
    await login(page, "tech03");
    await page.goto(UI + "/pages/technician-job-detail.html?id=1019"); await waitNotice(page, "#detail-api-notice");
    await Promise.all([page.waitForURL(/technician-tasks\.html/), page.click(".tech-back")]);
    await waitTasks(page);
    const ids = await taskCardIds(page);
    check("กลับไปงานของฉัน", /technician-tasks\.html$/.test(page.url()), page.url());
    check("รายการงานแสดงครบ", ids.includes(1019) && ids.includes(1020), ids.join(","));
    actual(`กด ‹ กลับไปงานของฉัน → ${page.url().replace(UI, "")} · ${ids.length} งาน`);
  });

  await runCase("UI-U7-011", async ({ page, check, actual }) => {
    let block = true;
    await page.route((u) => u.href.startsWith(API + "/api/technician/repair-requests/assigned"), (r) => (block ? r.abort("internetdisconnected") : r.continue()));
    await login(page, "tech03");
    await waitTasks(page);
    const notice = (await text(page, "#api-notice")) || "";
    const retry = page.locator("#api-notice button", { hasText: "ลองอีกครั้ง" });
    const hasRetry = await retry.count();
    check("แถบแจ้งเตือนขึ้นโหลดรายการงานไม่สำเร็จ", notice.includes("โหลดรายการงานไม่สำเร็จ"), notice);
    check("มีปุ่มลองอีกครั้ง", hasRetry === 1);
    block = false;
    if (hasRetry) { await retry.click(); await waitTasks(page); }
    const ids = await taskCardIds(page);
    check("กดลองอีกครั้งแล้วโหลดได้", ids.length > 0, ids.length);
    actual(`ตัดการเชื่อมต่อ → "${short(notice, 70)}" · กดลองอีกครั้ง → ${ids.length} งาน`);
  });

  await runCase("UI-U8-013", async ({ page, check, actual }) => {
    await login(page, "tech05");
    await page.goto(UI + "/pages/technician-completed-detail.html?id=1003"); await waitNotice(page);
    const imgs = await page.$$eval("#after-photo img", (i) => i.map((x) => ({ src: x.getAttribute("src"), ok: x.complete && x.naturalWidth > 0 })));
    check("รูปหลังซ่อม /uploads/1003-after.jpg อยู่ในช่องรูปหลังซ่อม", imgs.some((i) => i.src.endsWith("/uploads/1003-after.jpg")), imgs.map((i) => i.src).join(","));
    check("รูปโหลดได้", imgs.length > 0 && imgs.every((i) => i.ok));
    actual(`#1003 รูปหลังซ่อม ${imgs.map((i) => i.src.split("/").pop() + (i.ok ? " (โหลดได้)" : " (โหลดไม่ได้)")).join(", ")}`);
  });

  await runCase("UI-U8-018", async ({ page, check, actual }) => {
    await login(page, "tech05");
    await page.goto(UI + "/pages/technician-completed-detail.html?id=1003"); await waitNotice(page);
    const result = await text(page, "#repair-result");
    const before = await page.$$eval("#before-photo img", (i) => i.filter((x) => x.complete && x.naturalWidth > 0).length);
    const after = await page.$$eval("#after-photo img", (i) => i.filter((x) => x.complete && x.naturalWidth > 0).length);
    check("ผลการซ่อมตรงกับที่บันทึก", result === "ล้างแผ่นกรองและเติมน้ำยาแอร์ ใช้งานได้ปกติ", result);
    check("รูปก่อนซ่อม 1 รูปโหลดได้", before === 1, before);
    check("รูปหลังซ่อม 1 รูปโหลดได้", after === 1, after);
    actual(`#1003 ผลการซ่อม "${result}" · รูปก่อน ${before} · รูปหลัง ${after}`);
  });

  await runCase("UI-U8-001", async ({ page, check, actual }) => {
    await login(page, "tech03");
    await page.goto(UI + "/pages/technician-job-detail.html?id=1020"); await waitNotice(page, "#detail-api-notice");
    await Promise.all([page.waitForURL(/technician-submit\.html\?id=1020/), page.click("#handover-btn")]);
    await openSubmit(page, 1020);
    const api = await staffDetail(1020);
    const title = await text(page, "#job-title");
    const parts = await Promise.all(["#repair-result", ".upload-btn", "#submit-btn"].map((s) => shown(page, s)));
    check("เปิดหน้าส่งมอบของ #1020", /technician-submit\.html\?id=1020/.test(page.url()), page.url());
    check("ข้อมูลงานตรงกับ #1020", title === api.title, title);
    check("มีช่องผลการซ่อม ปุ่มแนบรูป ปุ่มยืนยัน", parts.every(Boolean), parts.join(","));
    actual(`กดส่งมอบงานจาก #1020 → ${page.url().replace(UI, "")} · ข้อมูลงาน "${title}"`);
  });

  await runCase("UI-U8-002", async ({ shot }) => {
    for (const [name, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
      const s = await newSession(vp);
      await login(s.page, "tech03"); await openSubmit(s.page, 1020);
      await shot(name, s.page);
      await s.ctx.close();
    }
  });

  await runCase("UI-U8-003", async ({ page, check, actual, rec }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    const long = "เปลี่ยนท่อน้ำทิ้งใต้อ่างล้างจานใหม่ทั้งชุด ".repeat(10).slice(0, 300);
    await page.fill("#repair-result", long);
    const val = await page.inputValue("#repair-result");
    check("ช่องเก็บข้อความครบ 300 ตัวอักษร", val.length === 300 && val === long, val.length);
    check("ไม่ขึ้นข้อความเตือน", !(await shown(page, "#repair-result-error")));
    check("ไม่มี POST (แค่กรอก)", calls(rec, "POST", /\/complete$/).length === 0);
    actual(`กรอก ${long.length} ตัวอักษร → ในช่อง ${val.length} ตัวอักษร ครบ ไม่ถูกตัด`);
  });

  await runCase("UI-U8-004", async ({ page, check, actual, rec }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    await setFiles(page, ["ok1.jpg"]);
    await page.click("#submit-btn"); await sleep(300);
    const e = await text(page, "#repair-result-error");
    const f = await text(page, "#form-error");
    check("ขึ้น \"กรุณากรอกผลการซ่อม\" ใต้ช่อง", await shown(page, "#repair-result-error") && e === "กรุณากรอกผลการซ่อม", e);
    check("ขึ้น \"กรุณากรอกข้อมูลให้ครบ\"", await shown(page, "#form-error") && f === "กรุณากรอกข้อมูลให้ครบ", f);
    check("ไม่มี POST ไป API", calls(rec, "POST", /\/complete$/).length === 0);
    actual(`ไม่กรอกผล + แนบ 1 รูป → "${e}" / "${f}" · ไม่มี POST`);
  });

  await runCase("UI-U8-005", async ({ page, check, actual }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    await setFiles(page, ["ok1.jpg"]); await sleep(200);
    const caps = await page.$$eval("#image-preview figcaption", (c) => c.map((x) => x.textContent));
    const ok = await page.$$eval("#image-preview img", (i) => i.filter((x) => x.complete && x.naturalWidth > 0).length);
    const count = await text(page, "#image-count");
    check("แสดงรูปตัวอย่าง", ok === 1, ok);
    check("แสดงชื่อไฟล์", caps[0] === "ok1.jpg", caps.join(","));
    check("ข้อความ แนบรูปแล้ว 1 จาก 3 รูป", count === "แนบรูปแล้ว 1 จาก 3 รูป", count);
    actual(`แนบ ok1.jpg → ตัวอย่าง 1 รูป ชื่อ ${caps[0]} · "${count}"`);
  });

  for (const [id, file] of [["UI-U8-006", "doc.pdf"], ["UI-U8-007", "big.jpg"]]) {
    await runCase(id, async ({ page, check, actual }) => {
      await login(page, "tech03"); await openSubmit(page, 1020);
      await setFiles(page, [file]); await sleep(200);
      const e = await text(page, "#images-error");
      const count = await text(page, "#image-count");
      const n = await page.evaluate(() => document.getElementById("images").files.length);
      check("ขึ้น \"รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB\"", await shown(page, "#images-error") && e === "รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB", e);
      check("ไม่รับไฟล์ (จำนวนรูป 0)", count === "แนบรูปแล้ว 0 จาก 3 รูป" && n === 0, `${count} / files ${n}`);
      actual(`แนบ ${file} → "${e}" · "${count}"`);
    });
  }

  await runCase("UI-U8-008", async ({ page, check, actual }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    await setFiles(page, ["ok1.jpg", "ok2.jpg", "ok3.jpg"]); await sleep(200);
    const c3 = await text(page, "#image-count");
    const e3 = await shown(page, "#images-error");
    await setFiles(page, ["ok1.jpg", "ok2.jpg", "ok3.jpg", "ok4.jpg"]); await sleep(200);
    const c4 = await text(page, "#image-count");
    const e4 = await text(page, "#images-error");
    check("3 รูปรับได้", c3 === "แนบรูปแล้ว 3 จาก 3 รูป" && !e3, c3);
    check("4 รูปขึ้น \"แนบรูปได้ไม่เกิน 3 รูป\"", e4 === "แนบรูปได้ไม่เกิน 3 รูป" && await shown(page, "#images-error"), e4);
    check("4 รูปไม่ถูกรับ", c4 === "แนบรูปแล้ว 0 จาก 3 รูป", c4);
    actual(`3 รูป → "${c3}" · 4 รูป → "${e4}" (${c4})`);
  });

  await runCase("UI-U8-009", async ({ page, check, actual }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    await setFiles(page, ["ok1.jpg", "ok2.jpg"]); await sleep(200);
    await setFiles(page, ["ok3.jpg"]); await sleep(200);
    const caps = await page.$$eval("#image-preview figcaption", (c) => c.map((x) => x.textContent));
    const files = await page.evaluate(() => [...document.getElementById("images").files].map((f) => f.name));
    const count = await text(page, "#image-count");
    const xBtn = await page.locator("#image-preview button").count();
    check("รูปตัวอย่างเหลือแค่ ok3.jpg", caps.join(",") === "ok3.jpg", caps.join(","));
    check("ไฟล์ที่จะส่งเหลือ ok3.jpg ไฟล์เดียว", files.join(",") === "ok3.jpg", files.join(","));
    check("ข้อความ 1 จาก 3 รูป", count === "แนบรูปแล้ว 1 จาก 3 รูป", count);
    if (!xBtn) actual("(ไม่มีปุ่มลบรายรูป)");
    actual(`แนบ ok1+ok2 แล้วแนบใหม่ ok3 → ตัวอย่าง ${caps.join(",")} · ไฟล์ ${files.join(",")} · "${count}"`);
  });

  await runCase("UI-FIG-U8-01", async ({ page, check, actual, rec }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    await page.click("#submit-btn"); await sleep(300);
    const e1 = await text(page, "#repair-result-error");
    const e2 = await text(page, "#images-error");
    const api = await staffDetail(1020);
    check("ขึ้น \"กรุณากรอกผลการซ่อม\"", e1 === "กรุณากรอกผลการซ่อม" && await shown(page, "#repair-result-error"), e1);
    check("ขึ้น \"กรุณาแนบรูปหลังซ่อมอย่างน้อย 1 รูป\"", e2 === "กรุณาแนบรูปหลังซ่อมอย่างน้อย 1 รูป" && await shown(page, "#images-error"), e2);
    check("ไม่มี POST และสถานะไม่เปลี่ยน", calls(rec, "POST", /\/complete$/).length === 0 && api.status === "IN_PROGRESS", api.status);
    actual(`ไม่กรอก ไม่แนบ → "${e1}" + "${e2}" · ไม่มี POST · #1020 ${api.status}`);
  });

  await runCase("UI-FIG-U8-02", async ({ page, check, actual, rec }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    await page.fill("#repair-result", "ซ่อมเสร็จแล้ว");
    await page.click("#submit-btn"); await sleep(300);
    const e2 = await text(page, "#images-error");
    check("ขึ้น \"กรุณาแนบรูปหลังซ่อมอย่างน้อย 1 รูป\"", e2 === "กรุณาแนบรูปหลังซ่อมอย่างน้อย 1 รูป" && await shown(page, "#images-error"), e2);
    check("ช่องผลการซ่อมไม่ขึ้นเตือน", !(await shown(page, "#repair-result-error")));
    check("ไม่มี POST", calls(rec, "POST", /\/complete$/).length === 0);
    actual(`กรอกผล ไม่แนบรูป → "${e2}" · ไม่มี POST`);
  });

  await runCase("UI-FIG-U8-03", async ({ page, check, actual, rec }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    await setFiles(page, ["ok1.jpg"]);
    await page.click("#submit-btn"); await sleep(300);
    const e1 = await text(page, "#repair-result-error");
    check("ขึ้น \"กรุณากรอกผลการซ่อม\"", e1 === "กรุณากรอกผลการซ่อม" && await shown(page, "#repair-result-error"), e1);
    check("ช่องรูปไม่ขึ้นเตือน", !(await shown(page, "#images-error")));
    check("ไม่มี POST", calls(rec, "POST", /\/complete$/).length === 0);
    actual(`แนบรูป ไม่กรอกผล → "${e1}" · ไม่มี POST`);
  });

  await runCase("UI-FIG-U8-04", async ({ page, check, actual }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    const out = [];
    for (const [files, expect] of [[["ok1.jpg"], "ok"], [["ok_png.png"], "ok"], [["doc.pdf"], "type"], [["big.jpg"], "type"], [["ok1.jpg", "ok2.jpg", "ok3.jpg", "ok4.jpg"], "count"]]) {
      await setFiles(page, files); await sleep(200);
      const err = (await shown(page, "#images-error")) ? await text(page, "#images-error") : "";
      const count = await text(page, "#image-count");
      const want = { ok: "", type: "รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB", count: "แนบรูปได้ไม่เกิน 3 รูป" }[expect];
      check(`${files.join("+")} → ${expect === "ok" ? "รับได้" : `"${want}"`}`, err === want && (expect !== "ok" || count === `แนบรูปแล้ว ${files.length} จาก 3 รูป`), `"${err}" ${count}`);
      out.push(`${files.length > 1 ? "4 รูป" : files[0]}: ${expect === "ok" ? "รับ" : err}`);
    }
    actual(out.join(" · "));
  });

  await runCase("UI-U8-016", async ({ page, check, actual }) => {
    await page.route((u) => u.href.startsWith(API) && /\/complete$/.test(u.pathname), (r) => r.abort("internetdisconnected"));
    await login(page, "tech03"); await openSubmit(page, 1019);
    await page.fill("#repair-result", "เปลี่ยนก๊อกน้ำใหม่");
    await setFiles(page, ["ok1.jpg"]);
    await page.click("#submit-btn");
    await page.waitForFunction(() => document.getElementById("form-error")?.classList.contains("is-visible"), null, { timeout: 10000 }).catch(() => {});
    const err = await text(page, "#form-error");
    const val = await page.inputValue("#repair-result");
    const files = await page.evaluate(() => document.getElementById("images").files.length);
    const api = await staffDetail(1019);
    check("ขึ้นข้อความผิดพลาด", !!err && await shown(page, "#form-error"), err);
    check("ไม่ขึ้นหน้าสำเร็จ", !(await shown(page, "#success-view")));
    check("ปุ่มกดได้อีกครั้ง", await page.locator("#submit-btn").isEnabled());
    check("ผลการซ่อมและรูปยังอยู่ในฟอร์ม", val === "เปลี่ยนก๊อกน้ำใหม่" && files === 1, `"${val}" · ${files} ไฟล์`);
    check("#1019 ยังเป็นกำลังดำเนินการ", api.status === "IN_PROGRESS", api.status);
    actual(`ตัดการเชื่อมต่อ POST → "${err}" · ข้อมูลในฟอร์มยังอยู่ · #1019 ${api.status}`);
  });

  await runCase("UI-U8-017", async ({ page, check, actual }) => {
    await login(page, "tech04"); await openSubmit(page, 1019);
    const msg = await text(page, "#page-error-message");
    const formShown = await shown(page, "#submit-form");
    const fd = new FormData();
    fd.append("repairResult", "ทดสอบสิทธิ์");
    fd.append("afterImages", new Blob([await fs.readFile(fx("ok1.jpg"))], { type: "image/jpeg" }), "ok1.jpg");
    const post = await apiJson("POST", "/api/technician/repair-requests/1019/complete", { user: "tech04", body: fd });
    const api = await staffDetail(1019);
    check("หน้าเว็บขึ้น \"งานนี้ไม่ได้ถูกมอบหมายให้คุณ\"", (msg || "").includes("ไม่ได้ถูกมอบหมายให้คุณ") && await shown(page, "#page-error"), msg);
    check("ไม่มีฟอร์มให้ส่ง", !formShown);
    check("API ปฏิเสธ (4xx)", post.status >= 400 && post.status < 500, `${post.status} ${post.data?.message || ""}`);
    check("งานไม่เปลี่ยนสถานะ", api.status === "IN_PROGRESS", api.status);
    actual(`tech04 เปิดงานของ tech03 → "${msg}" · POST ตรง = ${post.status} "${post.data?.message || ""}" · #1019 ${api.status}`);
  });
}

async function commonReadCases() {
  await runCase("UI-COMMON-001", async ({ check, actual, shot }) => {
    const pages = [
      ["staff01", "/pages/staff-requests.html", "list"],
      ["staff01", "/pages/staff-request-detail.html?id=1024", "detail-pending"],
      ["staff01", "/pages/staff-request-detail.html?id=1003", "detail-done"],
      ["tech03", "/pages/technician-tasks.html", "tasks"],
      ["tech03", "/pages/technician-job-detail.html?id=1019", "job"],
      ["tech03", "/pages/technician-submit.html?id=1020", "submit"],
      ["tech05", "/pages/technician-completed.html", "completed"],
      ["tech05", "/pages/technician-completed-detail.html?id=1003", "completed-detail"],
    ];
    const bad = [];
    for (const [vpName, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
      for (const user of ["staff01", "tech03", "tech05"]) {
        const s = await newSession(vp);
        await login(s.page, user);
        for (const [u, p, name] of pages.filter((x) => x[0] === user)) {
          await s.page.goto(UI + p);
          await s.page.waitForLoadState("networkidle").catch(() => {});
          await sleep(500);
          const r = await noHorizontalScroll(s.page);
          check(`${name} ${vpName}: ไม่มีเลื่อนซ้ายขวา`, r.ok, `${r.scroll}px / จอ ${r.client}px`);
          if (!r.ok) bad.push(`${name} ${vpName} (${r.scroll}px)`);
          await shot(`${name}_${vpName}`, s.page);
        }
        await s.ctx.close();
      }
    }
    actual(bad.length ? `ล้นจอ: ${bad.join(", ")}` : `8 หน้า × จอคอม/มือถือ ไม่มีหน้าไหนเลื่อนซ้ายขวา (แคปภาพไว้ ${pages.length * 2} รูป)`);
  });

  await runCase("UI-COMMON-002", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1019, "&returnStatus=IN_PROGRESS&returnPage=1");
    await clickBackToList(page);
    const a = page.url();
    const s = await newSession();
    await login(s.page, "tech03");
    const hops = [];
    for (const [from, sel, to] of [
      ["/pages/technician-job-detail.html?id=1019", ".tech-back", /technician-tasks\.html$/],
      ["/pages/technician-submit.html?id=1020", "#back-link", /technician-job-detail\.html\?id=1020$/],
    ]) {
      await s.page.goto(UI + from); await s.page.waitForLoadState("networkidle").catch(() => {}); await sleep(300);
      await Promise.all([s.page.waitForURL(to, { timeout: 10000 }).catch(() => {}), s.page.click(sel)]);
      hops.push([from, s.page.url(), to.test(s.page.url())]);
    }
    await s.ctx.close();
    const c = await newSession();
    await login(c.page, "tech05");
    await c.page.goto(UI + "/pages/technician-completed-detail.html?id=1003"); await waitNotice(c.page);
    await Promise.all([c.page.waitForURL(/technician-completed\.html$/, { timeout: 10000 }).catch(() => {}), c.page.click(".tech-back")]);
    hops.push(["/pages/technician-completed-detail.html?id=1003", c.page.url(), /technician-completed\.html$/.test(c.page.url())]);
    await c.ctx.close();
    check("รายละเอียดคำร้อง → รายการคำร้อง (ตัวกรองเดิม)", /staff-requests\.html\?status=IN_PROGRESS/.test(a), a);
    for (const [from, to, ok] of hops) check(`${from.split("/").pop()} → ${to.replace(UI, "")}`, ok);
    actual(`รายละเอียดคำร้อง → ${a.replace(UI, "")} · ${hops.map(([f, t]) => `${f.split("/").pop().split("?")[0]} → ${t.replace(UI + "/pages/", "")}`).join(" · ")}`);
  });

  await runCase("UI-COMMON-003", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, 1024);
    const reach = async (pg, targets, max = 60) => {
      const seen = new Set();
      await pg.evaluate(() => { document.activeElement?.blur(); document.body.tabIndex = -1; document.body.focus(); });
      for (let i = 0; i < max; i++) {
        await pg.keyboard.press("Tab");
        const f = await pg.evaluate(() => { const e = document.activeElement; return e ? (e.id || `${e.name || ""}=${e.value || ""}` || e.className) : ""; });
        for (const t of targets) if (f === t || f.startsWith(t)) seen.add(t);
      }
      return targets.map((t) => [t, seen.has(t)]);
    };
    const assign = await reach(page, ["urgency=", "slot=", "technician=", "assign-btn"]);
    const s = await newSession();
    await login(s.page, "tech03"); await openSubmit(s.page, 1020);
    const submit = await reach(s.page, ["repair-result", "images", "submit-btn"], 40);
    const uploadFocusable = await s.page.evaluate(() => { const l = document.querySelector(".upload-btn"); const i = document.getElementById("images"); return { labelTab: l?.tabIndex, inputHidden: i?.hidden }; });
    await s.ctx.close();
    for (const [tgt, ok] of [...assign, ...submit]) check(`กด Tab ไปถึง ${tgt}`, ok);
    const miss = [...assign, ...submit].filter((x) => !x[1]).map((x) => x[0]);
    actual(miss.length ? `Tab ไปไม่ถึง: ${miss.join(", ")}${miss.includes("images") ? ` (ปุ่มแนบรูปเป็น label ที่ tabIndex=${uploadFocusable.labelTab} และ input ถูกซ่อน)` : ""}` : "Tab ไปถึงทุกช่องและปุ่มในฟอร์มมอบหมายและฟอร์มส่งมอบงาน");
  });

  await runCase("UI-COMMON-004", async ({ note }) => { note("ใช้ภาพจาก UI-COMMON-001"); });
  await runCase("UI-COMMON-009", async ({ note }) => { note("ใช้ภาพจาก UI-COMMON-001"); });

  await runCase("UI-COMMON-005", async ({ page, check, actual, rec }) => {
    const out = [];
    for (const [user, p] of [["staff01", "/pages/staff-requests.html"], ["tech03", "/pages/technician-tasks.html"]]) {
      await login(page, user);
      await page.evaluate(() => localStorage.setItem("token", "expired-invalid-token"));
      await page.goto(UI + p);
      await page.waitForURL(/login\.html/, { timeout: 10000 }).catch(() => {});
      const st = rec.requests.filter((r) => r.auth.includes("invalid-token")).map((r) => r.status);
      const left = await page.evaluate(() => localStorage.getItem("token"));
      check(`${p.split("/").pop()}: API ตอบ 401`, st.includes(401), st.join(","));
      check(`${p.split("/").pop()}: พาไปหน้า login`, /login\.html/.test(page.url()), page.url());
      check(`${p.split("/").pop()}: ล้าง token ออก`, !left);
      out.push(`${p.split("/").pop()} → ${st.join(",")} → ${page.url().replace(UI, "")}`);
      rec.requests.length = 0;
    }
    actual(out.join(" · "));
  });

  await runCase("UI-COMMON-007", async ({ page, check, actual }) => {
    await page.route((u) => u.href.startsWith(API + "/api/staff/repair-requests") || u.href.startsWith(API + "/api/technician/"), async (r) => { await sleep(1500); await r.continue(); });
    await login(page, "staff01").catch(() => {});
    await page.goto(UI + "/pages/staff-requests.html");
    await sleep(500);
    const l1 = await shown(page, "#loading-state");
    const t1 = await text(page, "#loading-state");
    await waitList(page);
    const l1after = await shown(page, "#loading-state");
    const s = await newSession();
    await s.page.route((u) => u.href.startsWith(API + "/api/technician/"), async (r) => { await sleep(1500); await r.continue(); });
    await login(s.page, "tech03");
    await s.page.goto(UI + "/pages/technician-tasks.html");
    await sleep(500);
    const t2 = await text(s.page, "#api-notice");
    await waitTasks(s.page);
    const t2after = await text(s.page, "#api-notice");
    await s.ctx.close();
    check("รายการคำร้องขึ้น กำลังโหลดรายการคำร้อง...", l1 && (t1 || "").includes("กำลังโหลด"), t1);
    check("โหลดเสร็จแล้วข้อความกำลังโหลดหายไป", !l1after);
    check("งานของฉันขึ้นกำลังโหลด", (t2 || "").includes("กำลังโหลด"), t2);
    check("งานของฉันโหลดเสร็จแล้วข้อความเปลี่ยน", !(t2after || "").includes("กำลังโหลด"), t2after);
    actual(`หน่วง API 1.5 วินาที → "${t1}" / "${t2}" แล้วหายเมื่อโหลดเสร็จ`);
  });

  await runCase("UI-COMMON-008", async ({ page, check, actual }) => {
    const leak = /exception|stack|trace|org\.springframework|java\.|sql|hibernate|at com\./i;
    await login(page, "staff01");
    await page.goto(UI + "/pages/staff-request-detail.html?id=999999"); await sleep(1500);
    const m1 = (await text(page, "#detail-error-message")) || "";
    const s = await newSession();
    await login(s.page, "tech03"); await openSubmit(s.page, 999999);
    const m2 = (await text(s.page, "#page-error-message")) || "";
    const body2 = await s.page.innerText("body");
    await s.ctx.close();
    const body1 = await page.innerText("body");
    check("รายละเอียดคำร้องขึ้นข้อความภาษาไทย", /[ก-๙]/.test(m1) && await shown(page, "#detail-error"), m1);
    check("หน้าส่งมอบขึ้นข้อความภาษาไทย", /[ก-๙]/.test(m2), m2);
    check("ไม่มี stack trace / ชื่อ class Java / SQL บนหน้าจอ", !leak.test(body1) && !leak.test(body2));
    actual(`id=999999 → "${m1}" / "${m2}" · ไม่มีข้อมูลทางเทคนิครั่ว`);
  });

  await runCase("UI-COMMON-011", async ({ page, check, actual }) => {
    await login(page, "tech01"); await waitTasks(page);
    const ids = await taskCardIds(page);
    const apiMine = ((await apiJson("GET", "/api/technician/repair-requests/assigned", { user: "tech01" })).data || []).map((j) => j.requestId);
    const other = await apiJson("GET", "/api/staff/repair-requests/1019", { user: "tech04" });
    const s = await newSession();
    await login(s.page, "resident01");
    await s.page.goto(UI + "/pages/request-detail.html?id=1003"); await s.page.waitForLoadState("networkidle").catch(() => {}); await sleep(500);
    const afterImg = await s.page.$$eval("img", (i) => i.filter((x) => /after/.test(x.getAttribute("src") || "")).length);
    await s.ctx.close();
    check("ช่างเห็นเฉพาะงานของตัวเอง", ids.every((x) => apiMine.includes(x)), `UI ${ids.join(",") || "-"} / API ${apiMine.join(",") || "-"}`);
    check("tech04 เปิดงานของ tech03 ไม่ได้ (403)", other.status === 403, other.status);
    check("หน้าผู้พักอาศัยไม่มีรูปหลังซ่อม", afterImg === 0, afterImg);
    actual(`tech01 เห็น ${ids.length} งานของตัวเอง · tech04 → #1019 = ${other.status} · resident01 #1003 รูปหลังซ่อม ${afterImg} รูป`);
  });
}

// ================================================================ PHASE B: สร้างคำร้องเพิ่มแล้วเปลี่ยนสถานะ
async function paginationCases() {
  await runCase("UI-U4-017", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await chip(page, "PENDING");
    await page.click('#page-list [data-page="2"]'); await waitList(page);
    const p2 = await listedIds(page);
    await Promise.all([page.waitForURL(/staff-request-detail/), page.locator("#request-list a").first().click()]);
    await waitDetail(page);
    const label = await text(page, "#back-label");
    await clickBackToList(page);
    const url = page.url();
    const back = await listedIds(page);
    const active = await page.locator('#status-filter [data-status="PENDING"]').evaluate((c) => c.classList.contains("is-active"));
    const all = await staffAll();
    check("ลิงก์กลับเขียนว่า รอรับเรื่อง หน้า 2", (label || "").includes("รอรับเรื่อง หน้า 2"), label);
    check("กลับมาที่ status=PENDING&page=2", /status=PENDING/.test(url) && /page=2/.test(url), url);
    check("ตัวกรองรอรับเรื่องยัง active", active);
    check("รายการเป็นชุดเดิมและเป็นรอรับเรื่องทั้งหมด", JSON.stringify(back) === JSON.stringify(p2) && back.every((id) => all.find((r) => r.requestId === id)?.status === "PENDING"), back.join(","));
    actual(`รอรับเรื่อง หน้า 2 (${p2.map((x) => "#" + x).join(" ")}) → เปิดรายละเอียด → "${label}" → กลับมา ${url.replace(UI, "")}`);
  }, { viewport: MOBILE });

  await runCase("UI-U4-018", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await chip(page, "PENDING");
    const p1 = await listedIds(page);
    const prev1 = await page.locator("#previous-page-btn").isDisabled();
    await page.click('#page-list [data-page="2"]'); await waitList(page);
    const p2 = await listedIds(page);
    const next2 = await page.locator("#next-page-btn").isDisabled();
    const cur = await page.locator("#page-list .is-active").innerText();
    await page.click("#previous-page-btn"); await waitList(page);
    const p1b = await listedIds(page);
    await page.click("#next-page-btn"); await waitList(page);
    const p2b = await listedIds(page);
    check("หน้า 1: ปุ่มก่อนหน้าปิด", prev1);
    check("หน้า 2: ปุ่มถัดไปปิด", next2);
    check("เลขหน้า 2 ถูกไฮไลต์", cur.trim() === "2", cur);
    check("ก่อนหน้า/ถัดไปได้รายการตรงกับหน้า", JSON.stringify(p1b) === JSON.stringify(p1) && JSON.stringify(p2b) === JSON.stringify(p2) && !p1.some((x) => p2.includes(x)), `${p1.join(",")} | ${p2.join(",")}`);
    actual(`รอรับเรื่อง: หน้า 1 ${p1.length} รายการ (ก่อนหน้า disabled) · หน้า 2 ${p2.length} รายการ (ถัดไป disabled) · เลขหน้า 2 active`);
  }, { viewport: MOBILE });

  await runCase("UI-FIG-U4-04", async ({ page, check, actual }) => {
    await login(page, "staff01");
    const total = (await staffAll()).length;
    const last = Math.ceil(total / 5);
    const i1 = await text(page, "#pagination-info");
    const prev1 = await page.locator("#previous-page-btn").isDisabled();
    await page.click("#next-page-btn"); await waitList(page);
    const i2 = await text(page, "#pagination-info");
    await page.click(`#page-list [data-page="${last}"]`); await waitList(page);
    const iL = await text(page, "#pagination-info");
    const nextL = await page.locator("#next-page-btn").isDisabled();
    check(`หน้า 1 "แสดง 1–5 จาก ${total} รายการ"`, i1 === `แสดง 1–5 จาก ${total} รายการ`, i1);
    check(`หน้า 2 "แสดง 6–10 จาก ${total} รายการ"`, i2 === `แสดง 6–${Math.min(10, total)} จาก ${total} รายการ`, i2);
    check("ปุ่มก่อนหน้าปิดในหน้าแรก / ถัดไปปิดในหน้าสุดท้าย", prev1 && nextL);
    actual(`"${i1}" → "${i2}" → หน้าสุดท้าย "${iL}" · prev/next disabled ถูกต้อง`);
  }, { viewport: MOBILE });

  await runCase("UI-FIG-U4-05", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await page.click("#next-page-btn"); await waitList(page);
    const p2 = await listedIds(page);
    await Promise.all([page.waitForURL(/staff-request-detail/), page.locator("#request-list a").first().click()]);
    await waitDetail(page);
    await clickBackToList(page);
    const url = page.url();
    const back = await listedIds(page);
    check("กลับมาที่หน้า 2 (page=2)", /page=2/.test(url), url);
    check("รายการเป็นชุดเดิม", JSON.stringify(back) === JSON.stringify(p2), `${p2.join(",")} / ${back.join(",")}`);
    actual(`ทั้งหมด หน้า 2 → รายละเอียด → กลับ ${url.replace(UI, "")} รายการเดิม`);
  }, { viewport: MOBILE });

  await runCase("UI-FIG-U4-01", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await search(page, String(R.r1));
    const ids = await listedIds(page);
    check(`แสดงเฉพาะ #${R.r1}`, ids.length === 1 && ids[0] === R.r1, ids.join(","));
    actual(`ค้น ${R.r1} → ${ids.map((x) => "#" + x).join(", ")}`);
  });

  await runCase("UI-FIG-U4-06", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, R.r1);
    const api = await staffDetail(R.r1);
    const all = (await page.innerText("#detail-content")).replace(/\s+/g, " ");
    const photos = await page.$$eval("#photo-grid img", (i) => i.filter((x) => x.complete && x.naturalWidth > 0).length);
    const badges = (await text(page, "#info-badges")) || "";
    check("เลขคำร้อง", all.includes(`#${R.r1}`));
    check("สถานะรอรับเรื่อง", badges.includes("รอรับเรื่อง"), badges);
    check("ชื่อเรื่อง สถานที่ ประเภท รายละเอียด ผู้แจ้ง", [api.title, "ไฟฟ้า", api.description, api.reporterName].every((x) => all.includes(x)) && all.includes("ห้อง 305"));
    check("รูปภาพ 2 รูปโหลดได้", photos === 2, photos);
    actual(`#${R.r1}: ${badges.replace(/\s+/g, " ")} · "${api.title}" · ${api.reporterName} · รูป ${photos} รูป`);
  });

  await runCase("UI-U6-003", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, R.r1);
    await pick(page, "slot", "SLOT_1");
    const s = NEW_REQUESTS.r1;
    const hint = (await text(page, "#tech-hint")) || "";
    const last = calls(rec, "GET", /\/api\/staff\/technicians$/).at(-1)?.path || "";
    check("ช่วงที่ 1 ถูกเลือก", await isChecked(page, "slot", "SLOT_1") && await cardSelected(page, "slot", "SLOT_1"));
    check("ข้อความสถานะคิวแสดงวันของช่วงที่ 1", hint.includes(thShort(D(s.d1))), hint);
    check("GET technicians ใช้ date/slot ของช่วงที่ 1", last.includes(`date=${D(s.d1)}`) && last.includes(`slot=${s.s1}`), last);
    actual(`ช่วงที่ 1 → "${short(hint, 60)}" · ${last}`);
  });

  await runCase("UI-U6-004", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, R.r1);
    await pick(page, "slot", "SLOT_2");
    const s = NEW_REQUESTS.r1;
    const hint = (await text(page, "#tech-hint")) || "";
    const last = calls(rec, "GET", /\/api\/staff\/technicians$/).at(-1)?.path || "";
    check("ช่วงที่ 2 ถูกเลือกแทน", await isChecked(page, "slot", "SLOT_2") && !(await isChecked(page, "slot", "SLOT_1")));
    check("ข้อความสถานะคิวแสดงวันของช่วงที่ 2", hint.includes(thShort(D(s.d2))), hint);
    check("โหลดช่างใหม่ด้วย date/slot ของช่วงที่ 2", last.includes(`date=${D(s.d2)}`) && last.includes(`slot=${s.s2}`), last);
    actual(`ช่วงที่ 2 → "${short(hint, 60)}" · ${last}`);
  });
}

async function assignCases() {
  // #r1: เลือกเร่งด่วน + ช่วงที่ 1 + tech01 แล้วมอบหมาย (FIG-U6-01, FIG-U5-01, FIG-U6-05, FIG-U6-06)
  const s1 = await runCase("UI-FIG-U6-01", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, R.r1);
    const s = NEW_REQUESTS.r1;
    const cards = await page.$$eval("#slot-options .choice", (c) => c.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
    check("การ์ดช่วงที่ 1 แสดงวันและช่วงเช้า", cards[0]?.includes(thShort(D(s.d1))) && cards[0]?.includes("ช่วงเช้า"), cards[0]);
    check("การ์ดช่วงที่ 2 แสดงวันและช่วงบ่าย", cards[1]?.includes(thShort(D(s.d2))) && cards[1]?.includes("ช่วงบ่าย"), cards[1]);
    await pick(page, "urgency", "URGENT");
    await pick(page, "slot", "SLOT_1");
    await pick(page, "technician", 5);
    const res = await submitAssign(page);
    const body = JSON.parse(calls(rec, "PUT", /\/assign$/).at(-1)?.body || "{}");
    check("PUT ส่ง appointmentDate/Slot ตรงกับช่วงที่ 1", body.appointmentDate === D(s.d1) && body.appointmentSlot === s.s1, JSON.stringify(body));
    check("PUT ได้ 200", res.status() === 200, res.status());
    actual(`ช่วงที่ 1 "${short(cards[0], 50)}" · ช่วงที่ 2 "${short(cards[1], 50)}" · PUT ${body.appointmentDate} ${body.appointmentSlot} → ${res.status()}`);
  }, { keep: true });

  if (s1) {
    await runCase("UI-FIG-U6-05", async ({ page, check, actual }) => {
      const rows = await successRows(page);
      const s = NEW_REQUESTS.r1;
      check("ขึ้นหน้ามอบหมายงานสำเร็จ", await shown(page, "#success-view"));
      check("แถวช่าง = วิชัย สายลม", (rows["ช่างผู้รับผิดชอบ"] || "").includes("วิชัย สายลม"), rows["ช่างผู้รับผิดชอบ"]);
      check("แถววันนัดตรงกับช่วงที่ 1", (rows["วันนัด"] || "").includes(thShort(D(s.d1))) && (rows["วันนัด"] || "").includes("ช่วงเช้า"), rows["วันนัด"]);
      check("แถวความเร่งด่วน = เร่งด่วน", rows["ความเร่งด่วน"] === "เร่งด่วน", rows["ความเร่งด่วน"]);
      check("แถวสถานะ = กำลังดำเนินการ", rows["สถานะ"] === "กำลังดำเนินการ", rows["สถานะ"]);
      actual(`หน้าสำเร็จ: ${Object.entries(rows).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    }, { session: s1 });

    await runCase("UI-FIG-U6-06", async ({ page, check, actual }) => {
      await page.click("#view-detail-btn");
      await waitDetail(page);
      const facts = (await text(page, "#assigned-facts")) || "";
      check("ไม่มีฟอร์มมอบหมาย", !(await shown(page, "#assign-form")));
      check("แสดงช่างและวันนัดแบบอ่านอย่างเดียว", (await shown(page, "#assigned-card")) && facts.includes("วิชัย สายลม") && facts.includes(thShort(D(NEW_REQUESTS.r1.d1))), short(facts, 120));
      actual(`กดดูรายละเอียดคำร้อง → อ่านอย่างเดียว · ${short(facts.replace(/\n+/g, " · "), 100)}`);
    }, { session: s1 });
    await s1.ctx.close();
  }

  await runCase("UI-FIG-U5-01", async ({ page, check, actual }) => {
    await login(page, "staff01");
    const api = await staffDetail(R.r1);
    const row = page.locator("#request-table-body tr", { hasText: `#${R.r1}` });
    const badge = await row.locator('[data-field="urgency"]').innerText().catch(() => "");
    await openDetail(page, R.r1);
    const info = (await text(page, "#info-badges")) || "";
    check("API ตอบ urgency = URGENT", api.urgency === "URGENT", api.urgency);
    check("รายการคำร้องแสดงป้ายเร่งด่วน", badge.trim() === "เร่งด่วน", badge);
    check("รายละเอียดแสดงป้ายเร่งด่วน", info.includes("เร่งด่วน"), info);
    actual(`#${R.r1} API urgency ${api.urgency} · รายการ "${badge.trim()}" · รายละเอียด "${info.replace(/\s+/g, " ")}"`);
  });

  await runCase("UI-COMMON-010", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await page.reload(); await waitList(page);
    const status = await page.locator("#request-table-body tr", { hasText: `#${R.r1}` }).locator('[data-field="status"]').innerText();
    await openDetail(page, R.r1);
    const facts = (await text(page, "#assigned-facts")) || "";
    check("หลังรีเฟรชยังเป็นกำลังดำเนินการ", status.trim() === "กำลังดำเนินการ", status);
    check("รายละเอียดเห็นช่างที่บันทึก", facts.includes("วิชัย สายลม"));
    actual(`รีเฟรชรายการ → #${R.r1} "${status.trim()}" · ช่าง วิชัย สายลม`);
  });

  // #r5: U5-007 ความเร่งด่วนบันทึกพร้อมการมอบหมาย
  await runCase("UI-U5-007", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, R.r5);
    await pick(page, "urgency", "URGENT");
    await pick(page, "technician", 6);
    await submitAssign(page);
    const body = JSON.parse(calls(rec, "PUT", /\/assign$/).at(-1)?.body || "{}");
    const rows = await successRows(page);
    await openDetail(page, R.r5);
    const ro = await shown(page, "#readonly-banner");
    await openList(page);
    const badge = await page.locator("#request-table-body tr", { hasText: `#${R.r5}` }).locator('[data-field="urgency"]').innerText();
    check("PUT ส่ง urgency = URGENT", body.urgency === "URGENT", body.urgency);
    check("หน้าสำเร็จความเร่งด่วน = เร่งด่วน", rows["ความเร่งด่วน"] === "เร่งด่วน", rows["ความเร่งด่วน"]);
    check("เปิดใหม่เป็นแบบอ่านอย่างเดียว", ro);
    check("รายการคำร้องแสดงป้ายเร่งด่วน", badge.trim() === "เร่งด่วน", badge);
    actual(`#${R.r5} เร่งด่วน + tech02 → PUT urgency ${body.urgency} · หน้าสำเร็จ "${rows["ความเร่งด่วน"]}" · รายการ "${badge.trim()}"`);
  });

  // #r2: U5-008 + U6-014 + U6-015
  await runCase("UI-U6-014", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, R.r2);
    const defaultUrgent = await isChecked(page, "urgency", "URGENT");
    await pick(page, "urgency", "NORMAL");
    await customAppt(page, { date: D(7), period: "AFTERNOON", note: "โทรตกลงกับผู้แจ้งแล้ว สะดวกช่วงบ่าย" });
    await pick(page, "technician", 8);
    const res = await submitAssign(page);
    const body = JSON.parse(calls(rec, "PUT", /\/assign$/).at(-1)?.body || "{}");
    const rows = await successRows(page);
    state.r2 = { defaultUrgent, body, status: res.status() };
    check("PUT ส่งค่าตรงกับที่กรอก", body.technicianId === 8 && body.appointmentDate === D(7) && body.appointmentSlot === "AFTERNOON" && body.appointmentNote === "โทรตกลงกับผู้แจ้งแล้ว สะดวกช่วงบ่าย" && body.urgency === "NORMAL", JSON.stringify(body));
    check("PUT ได้ 200", res.status() === 200, res.status());
    check("หน้าสำเร็จแสดงช่าง tech04", (rows["ช่างผู้รับผิดชอบ"] || "").includes("ประเสริฐ ประปาไทย"), rows["ช่างผู้รับผิดชอบ"]);
    check("หน้าสำเร็จแสดงวันนัดและช่วงบ่าย", (rows["วันนัด"] || "").includes(thShort(D(7))) && (rows["วันนัด"] || "").includes("ช่วงบ่าย"), rows["วันนัด"]);
    actual(`#${R.r2} กำหนดใหม่ ${D(7)} บ่าย + หมายเหตุ + tech04 → PUT ${res.status()} ${JSON.stringify(body)} · หน้าสำเร็จ ${rows["ช่างผู้รับผิดชอบ"]} / ${rows["วันนัด"]}`);
  });

  await runCase("UI-U5-008", async ({ check, actual }) => {
    const api = await staffDetail(R.r2);
    check("ค่าเริ่มต้นเป็นเร่งด่วน (ผู้แจ้งติ๊กมา)", state.r2?.defaultUrgent === true);
    check("PUT ส่ง urgency = NORMAL", state.r2?.body?.urgency === "NORMAL", state.r2?.body?.urgency);
    check("หลังบันทึก API ตอบ urgency = NORMAL", api.urgency === "NORMAL", api.urgency);
    actual(`#${R.r2} ค่าเริ่มต้นเร่งด่วน → เปลี่ยนเป็นปกติแล้วมอบหมาย (ใน UI-U6-014) · API urgency ${api.urgency}`);
  });

  await runCase("UI-U6-015", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, R.r2);
    const facts = (await text(page, "#assigned-facts")) || "";
    check("แสดงช่าง tech04", facts.includes("ประเสริฐ ประปาไทย"));
    check("แสดงวันนัดและช่วงบ่าย", facts.includes(thShort(D(7))) && facts.includes("ช่วงบ่าย"));
    check("แสดงหมายเหตุ", facts.includes("โทรตกลงกับผู้แจ้งแล้ว สะดวกช่วงบ่าย"));
    actual(`เปิด #${R.r2} อีกครั้ง → ${short(facts.replace(/\n+/g, " · "), 120)}`);
  });

  // #r3: U5-011 สองหน้าต่าง
  await runCase("UI-U5-011", async ({ page, check, actual }) => {
    await login(page, "staff01");
    await openDetail(page, R.r3);
    const b = await newSession();
    await login(b.page, "staff01");
    await openDetail(b.page, R.r3);
    await pick(page, "technician", 5);
    const ra = await submitAssign(page);
    await pick(b.page, "technician", 6);
    const rb = await submitAssign(b.page).catch(() => null);
    const msgB = (await shown(b.page, "#submit-error")) ? await text(b.page, "#submit-error-message") : "";
    const okB = await shown(b.page, "#success-view");
    await b.ctx.close();
    const api = await staffDetail(R.r3);
    check("หน้าต่าง A มอบหมายสำเร็จ", ra.status() === 200, ra.status());
    check("หน้าต่าง B ถูกปฏิเสธ (4xx) และขึ้นข้อความ", rb && rb.status() >= 400 && (msgB || "").length > 0 && !okB, `${rb?.status()} "${msgB}"`);
    check("ข้อมูลของ A ไม่ถูกเขียนทับ (ช่างยังเป็น tech01)", api.technician?.name === "วิชัย สายลม", api.technician?.name);
    actual(`A → ${ra.status()} · B → ${rb?.status()} "${msgB}" · ช่างยังเป็น ${api.technician?.name}`);
  });

  // #r4: U6-016 กดสองครั้ง
  await runCase("UI-U6-016", async ({ page, check, actual, rec }) => {
    await login(page, "staff01");
    await openDetail(page, R.r4);
    await pick(page, "technician", 5);
    const wait = page.waitForResponse((r) => isApi(r, "PUT", /\/assign$/), { timeout: 15000 });
    await page.locator("#assign-btn").dblclick();
    await page.locator("#assign-btn").click({ timeout: 500 }).catch(() => {});
    await wait;
    await sleep(1200);
    const puts = calls(rec, "PUT", /\/assign$/);
    const api = await staffDetail(R.r4);
    const inProgress = (api.statusHistory || []).filter((h) => h.status === "IN_PROGRESS").length;
    check("ส่ง PUT ครั้งเดียว", puts.length === 1, puts.length);
    check("ขึ้นหน้าสำเร็จ", await shown(page, "#success-view"));
    check("ประวัติสถานะมีกำลังดำเนินการแถวเดียว", inProgress === 1, inProgress);
    actual(`กดมอบหมาย 3 ครั้งติดกัน → PUT ${puts.length} ครั้ง · ประวัติ IN_PROGRESS ${inProgress} แถว`);
  });
}

async function techFlowCases() {
  await runCase("UI-FIG-U7-01", async ({ page, check, actual }) => {
    await login(page, "tech01"); await waitTasks(page);
    const card = page.locator(`.tech-task[href*="id=${R.r1}"]`);
    const cardText = (await card.innerText().catch(() => "")).replace(/\s+/g, " ");
    await page.goto(`${UI}/pages/technician-job-detail.html?id=${R.r1}`); await waitNotice(page, "#detail-api-notice");
    const api = await staffDetail(R.r1);
    const g = async (id) => (await text(page, `#${id}`)) || "";
    const photos = await page.$$eval("#request-photos img", (i) => i.filter((x) => x.complete && x.naturalWidth > 0).length);
    check("การ์ดมีเลขงาน ป้ายเร่งด่วน สถานะ", cardText.includes(`#${R.r1}`) && cardText.includes("เร่งด่วน") && cardText.includes("กำลังดำเนินการ"), short(cardText, 120));
    check("รายละเอียดมีเลขงาน ชื่อปัญหา", (await g("detail-request-id")).includes(String(R.r1)) && (await g("detail-title")) === api.title);
    check("สถานที่และรายละเอียดอาการตรง", (await g("detail-location")).includes("ห้อง 305") && (await g("detail-description")) === api.description);
    check("รูปก่อนซ่อม 2 รูป", photos === 2, photos);
    check("วันนัดตรง", (await g("detail-appointment-date")) === thLong(api.appointmentDate), `${await g("detail-appointment-date")} / ${thLong(api.appointmentDate)}`);
    actual(`tech01 การ์ด "${short(cardText, 70)}" · รายละเอียด "${api.title}" · รูปก่อนซ่อม ${photos} · นัด ${await g("detail-appointment-date")}`);
  });

  await runCase("UI-FIG-U7-02", async ({ page, check, actual }) => {
    await login(page, "tech01");
    await page.goto(`${UI}/pages/technician-job-detail.html?id=${R.r1}`); await waitNotice(page, "#detail-api-notice");
    const d = await text(page, "#detail-appointment-date");
    const sl = await text(page, "#detail-appointment-slot");
    const inputs = await page.$$eval("main input, main textarea, main select", (i) => i.length);
    check("วันที่นัดหมายตรงกับที่ยืนยัน", d === thLong(D(NEW_REQUESTS.r1.d1)), `${d} / ${thLong(D(NEW_REQUESTS.r1.d1))}`);
    check("ช่วงเวลา = ช่วงเช้า", (sl || "").includes("เช้า"), sl);
    check("ไม่มีช่องให้แก้ไข", inputs === 0, inputs);
    actual(`วันที่นัดหมาย ${d} · ${sl} · ช่องแก้ไข ${inputs}`);
  });

  await runCase("UI-FIG-U7-03", async ({ page, check, actual }) => {
    await login(page, "tech01");
    await page.goto(`${UI}/pages/technician-job-detail.html?id=${R.r1}`); await waitNotice(page, "#detail-api-notice");
    const api = await staffDetail(R.r1);
    const n = await text(page, "#detail-contact-name");
    const p = await text(page, "#detail-contact-phone");
    check("ผู้ติดต่อตรงกับผู้แจ้ง", n === api.reporterName, `${n} / ${api.reporterName}`);
    check("เบอร์ติดต่อตรง", p === api.reporterPhone, `${p} / ${api.reporterPhone}`);
    actual(`ผู้ติดต่อ ${n} · เบอร์ ${p}`);
  });

  await runCase("UI-FIG-U7-04", async ({ page, check, actual }) => {
    await login(page, "tech01");
    await page.goto(`${UI}/pages/technician-job-detail.html?id=${R.r1}`); await waitNotice(page, "#detail-api-notice");
    const items = await page.$$eval(".tech-timeline-item strong", (s) => s.map((x) => x.textContent.trim()));
    const api = await staffDetail(R.r1);
    check("ไทม์ไลน์ รับเรื่อง → กำลังดำเนินการ", items.join(">") === "รับเรื่อง>กำลังดำเนินการ", items.join(" → "));
    check("จำนวนขั้นตรงกับ statusHistory", items.length === (api.statusHistory || []).length, `${items.length} / ${(api.statusHistory || []).length}`);
    actual(`ไทม์ไลน์: ${items.join(" → ")}`);
  });

  await runCase("UI-U8-011", async ({ page, check, actual, rec }) => {
    await login(page, "tech03"); await openSubmit(page, 1020);
    await page.fill("#repair-result", "เปลี่ยนท่อน้ำทิ้งใต้อ่างใหม่ ทดสอบเปิดน้ำแล้วไม่รั่ว");
    await setFiles(page, ["ok1.jpg", "ok2.jpg"]);
    const res = await submitHandover(page);
    const form = rec.forms.at(-1) || { fields: {}, files: [] };
    const api = await staffDetail(1020);
    check("POST ส่ง repairResult + afterImages 2 ไฟล์", form.fields.repairResult?.startsWith("เปลี่ยนท่อน้ำทิ้ง") && form.files.filter((f) => f.field === "afterImages").length === 2, JSON.stringify(form.files.map((f) => f.filename)));
    check("POST ได้ 200", res.status() === 200, res.status());
    check("ขึ้นหน้าส่งมอบงานสำเร็จ", await shown(page, "#success-view"));
    check("#1020 เป็นเสร็จสิ้น", api.status === "COMPLETED", api.status);
    actual(`tech03 ส่งมอบ #1020 (2 รูป) → POST ${res.status()} · หน้าสำเร็จ · API ${api.status}`);
  });

  await runCase("UI-U8-012", async ({ page, check, actual }) => {
    await login(page, "tech03");
    await page.goto(UI + "/pages/technician-completed-detail.html?id=1020"); await waitNotice(page);
    const r = await text(page, "#repair-result");
    const tl = await page.$$eval(".tech-timeline-item strong", (s) => s.map((x) => x.textContent.trim()));
    check("แสดงผลการซ่อมที่ส่ง", r === "เปลี่ยนท่อน้ำทิ้งใต้อ่างใหม่ ทดสอบเปิดน้ำแล้วไม่รั่ว", r);
    check("ประวัติสถานะมีขั้นเสร็จสิ้น", tl.includes("เสร็จสิ้น"), tl.join(" → "));
    actual(`#1020 ผลการซ่อม "${r}" · ไทม์ไลน์ ${tl.join(" → ")}`);
  });

  await runCase("UI-U8-015", async ({ page, check, actual, rec }) => {
    await login(page, "tech01"); await openSubmit(page, R.r4);
    await page.fill("#repair-result", "ขันสกรูสวิตช์ใหม่ ใช้งานได้ปกติ");
    await setFiles(page, ["ok1.jpg"]);
    const wait = page.waitForResponse((r) => isApi(r, "POST", /\/complete$/), { timeout: 20000 });
    await page.locator("#submit-btn").dblclick();
    await page.locator("#submit-btn").click({ timeout: 500 }).catch(() => {});
    await wait; await sleep(1200);
    const posts = calls(rec, "POST", /\/complete$/);
    const api = await staffDetail(R.r4);
    const done = (api.statusHistory || []).filter((h) => h.status === "COMPLETED").length;
    check("ส่ง POST ครั้งเดียว", posts.length === 1, posts.length);
    check("ประวัติสถานะมีเสร็จสิ้นแถวเดียว", done === 1, done);
    actual(`กดยืนยัน 3 ครั้งติดกัน → POST ${posts.length} ครั้ง · ประวัติ COMPLETED ${done} แถว`);
  });

  const s6 = await runCase("UI-FIG-U8-06", async ({ page, check, actual }) => {
    await login(page, "tech01"); await openSubmit(page, R.r1);
    await page.fill("#repair-result", "เปลี่ยนเต้ารับไฟฟ้าหัวเตียงใหม่ ทดสอบแล้วใช้งานได้");
    await setFiles(page, ["ok3.jpg", "ok_png.png"]);
    const res = await submitHandover(page);
    const api = await staffDetail(R.r1);
    const t = await text(page, "#success-title");
    const r = await text(page, "#success-result");
    const time = await text(page, "#success-time");
    const imgs = await page.$$eval("#success-images img", (i) => i.length);
    check("ขึ้นหน้าส่งมอบงานสำเร็จ", res.status() === 200 && await shown(page, "#success-view"), res.status());
    check("แสดงชื่องาน ผลการซ่อม เวลาส่งมอบ", t === api.title && r.startsWith("เปลี่ยนเต้ารับ") && /\d{1,2}:\d{2} น\./.test(time || ""), `${t} / ${r} / ${time}`);
    check("รูปหลังซ่อม 2 รูป", imgs === 2, imgs);
    check("API สถานะ COMPLETED", api.status === "COMPLETED", api.status);
    actual(`#${R.r1} ส่งมอบสำเร็จ · "${t}" · ${time} · รูปหลังซ่อม ${imgs} · API ${api.status}`);
  }, { keep: true });

  if (s6) {
    await runCase("UI-FIG-U8-08", async ({ page, check, actual }) => {
        const detailHref = await page.getAttribute("#success-detail-link", "href");
      const tasksHref = await page.locator("#success-view a", { hasText: "กลับรายการงาน" }).getAttribute("href");
      await Promise.all([page.waitForURL(/technician-completed-detail\.html/), page.click("#success-detail-link")]);
      const u1 = page.url();
      await page.goto(new URL(tasksHref, u1).href);
      await waitTasks(page);
      const ids = await taskCardIds(page);
      check(`ดูรายละเอียดงาน → technician-completed-detail.html?id=${R.r1}`, u1.endsWith(`technician-completed-detail.html?id=${R.r1}`), u1);
      check("กลับรายการงาน → technician-tasks.html", /technician-tasks\.html$/.test(page.url()), page.url());
      check(`#${R.r1} ไม่อยู่ในงานที่ต้องทำแล้ว`, !ids.includes(R.r1), ids.join(","));
      actual(`ดูรายละเอียดงาน → ${detailHref} · กลับรายการงาน (${tasksHref}) → ${page.url().replace(UI, "")} · #${R.r1} ไม่อยู่ในงานที่ต้องทำ`);
    }, { session: s6 });
    await s6.ctx.close();
  }

  await runCase("UI-FIG-U8-07", async ({ page, check, actual }) => {
    await login(page, "tech01");
    await page.goto(UI + "/pages/technician-completed.html"); await waitNotice(page);
    const listed = await page.locator(`#completed-table-body a[href*="id=${R.r1}"]`).count();
    await page.goto(`${UI}/pages/technician-completed-detail.html?id=${R.r1}`); await waitNotice(page);
    const meta = await text(page, "#completed-meta");
    const r = await text(page, "#repair-result");
    const tech = await text(page, "#completed-technician");
    const before = await page.$$eval("#before-photo img", (i) => i.filter((x) => x.complete && x.naturalWidth > 0).length);
    const after = await page.$$eval("#after-photo img", (i) => i.filter((x) => x.complete && x.naturalWidth > 0).length);
    const tl = await page.$$eval(".tech-timeline-item strong", (s) => s.map((x) => x.textContent.trim()));
    check(`#${R.r1} อยู่ในงานที่เสร็จแล้ว`, listed > 0);
    check("สถานะเสร็จสิ้น และผลการซ่อม", (meta || "").includes("เสร็จสิ้น") && (r || "").startsWith("เปลี่ยนเต้ารับ"), `${meta} / ${r}`);
    check("ช่างผู้ดำเนินการ = วิชัย สายลม", tech === "วิชัย สายลม", tech);
    check("รูปก่อนซ่อม 2 รูป รูปหลังซ่อม 2 รูป", before === 2 && after === 2, `${before} / ${after}`);
    check("ไทม์ไลน์ 3 ขั้น", tl.length === 3, tl.join(" → "));
    actual(`งานที่เสร็จแล้วมี #${R.r1} · ${meta} · ช่าง ${tech} · รูปก่อน ${before} หลัง ${after} · ${tl.join(" → ")}`);
  });

  await runCase("UI-COMMON-012", async ({ page, check, actual }) => {
    const api = await staffDetail(R.r1);
    const seq = (api.statusHistory || []).map((h) => h.status);
    await login(page, "staff01");
    await openDetail(page, R.r1);
    const tl = await page.$$eval(".custom-timeline__title", (s) => s.map((x) => x.textContent.trim()));
    const s = await newSession();
    await login(s.page, "tech01"); await openSubmit(s.page, 1024);
    const msg = (await text(s.page, "#page-error-message")) || (await text(s.page, "#form-error")) || "";
    const canSend = (await shown(s.page, "#submit-form")) && (await s.page.locator("#submit-btn").isEnabled());
    await s.ctx.close();
    check("ประวัติสถานะ PENDING → IN_PROGRESS → COMPLETED", seq.join(">") === "PENDING>IN_PROGRESS>COMPLETED", seq.join(" → "));
    check("หน้าเจ้าหน้าที่แสดงไทม์ไลน์ 3 ขั้นตามลำดับ", tl.join(">") === "รอรับเรื่อง>กำลังดำเนินการ>เสร็จสิ้น", tl.join(" → "));
    check("ส่งมอบงานที่ยังรอรับเรื่อง (#1024) ไม่ได้", !canSend && msg.length > 0, msg);
    actual(`#${R.r1}: ${tl.join(" → ")} · tech01 เปิดส่งมอบ #1024 → "${msg}"`);
  });
}

const state = {};

// ================================================================ main
const ORDER = Object.keys(SPEC);
async function main() {
  await fs.mkdir(OUT, { recursive: true });
  console.log(`Task53 Integration Test UI ↔ API (Sprint 2) · หน้าเว็บ ${UI} · backend ${API}`);
  if (RESET) {
    console.log("รีเซ็ตฐานข้อมูล: docker compose down -v แล้ว up -d --build (รอสักครู่)…");
    const down = docker(["down", "-v"]);
    if (!down.ok) throw new Error("docker compose down -v ไม่สำเร็จ\n" + down.out.slice(-800));
    const up = docker(["up", "-d", "--build"]);
    if (!up.ok) throw new Error("docker compose up -d --build ไม่สำเร็จ\n" + up.out.slice(-800));
  }
  if (!(await waitBackend(RESET ? 240000 : 60000))) throw new Error(`backend ที่ ${API} ยังไม่พร้อม (ดู log ด้วย docker compose logs backend)`);
  const ui = await fetch(UI + "/pages/login.html").then((r) => r.status).catch(() => 0);
  if (ui !== 200) throw new Error(`เปิด ${UI} ไม่ได้ (รัน docker compose up --build ก่อน)`);

  const seed = await staffAll();
  const seedOk = seed.length === 6 && seed.find((r) => r.requestId === 1024)?.status === "PENDING" && seed.find((r) => r.requestId === 1020)?.status === "IN_PROGRESS";
  if (!seedOk && !ARGS.includes("--force")) {
    throw new Error(`ฐานข้อมูลไม่ใช่ข้อมูลตั้งต้น (มี ${seed.length} คำร้อง) ให้รัน node run-ui-api.mjs --reset หรือ docker compose down -v แล้ว up --build ก่อน`);
  }

  await launch();
  console.log(`เบราว์เซอร์: ${browserName}\n`);
  await makeFixtures();

  console.log("— Phase A: ข้อมูลตั้งต้น —");
  await staffListCases();
  await staffDetailReadCases();
  await techReadCases();
  await commonReadCases();
  console.log("\n— Phase B: สร้างคำร้องเพิ่มแล้วมอบหมาย / ส่งมอบ —");
  await createRequests();
  await paginationCases();
  await assignCases();
  await techFlowCases();
  naCases();
  await browser.close();

  results.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  await writeReports();
}

const STATUS_SHEET = { pass: "Pass", fail: "Fail", skip: "Blocked", manual: "Not Run", na: "N/A" };
const STATUS_TH = { pass: "ผ่าน", fail: "ไม่ผ่าน", skip: "รันไม่ได้", manual: "ให้คนตรวจ", na: "N/A" };
async function writeReports() {
  const count = (s) => results.filter((r) => r.status === s).length;
  const stamp = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const actualOf = (r) => {
    if (r.status === "manual") return `ต้องให้คนตรวจ: เปิดภาพ ${r.shots.join(", ") || "ใน UI-COMMON-001"} เทียบกับ Figma แล้วกรอกผล`;
    const a = r.actual.join(" · ");
    if (r.status === "fail") {
      const bad = r.checks.filter((c) => !c.ok).map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ""}`);
      return [a, r.error ? `error: ${r.error}` : "", bad.length ? `ไม่ผ่าน: ${bad.join("; ")}` : ""].filter(Boolean).join(" · ");
    }
    return a || r.error || r.skipped || "";
  };
  const evidenceOf = (r) => (r.status === "na" ? "" : [`${r.id}.png`, ...r.shots].join(", "));

  let md = `# ผล Task53 · Integration Test UI ↔ API (Sprint 2)\n\n`;
  md += `รันเมื่อ ${stamp} · หน้าเว็บ ${UI} · backend ${API} · เบราว์เซอร์ ${browserName}\n`;
  md += `คำร้องที่สคริปต์สร้าง: ${Object.entries(R).map(([k, v]) => `${k} #${v}`).join(", ")}\n\n`;
  md += `**ผ่าน ${count("pass")} · ไม่ผ่าน ${count("fail")} · รันไม่ได้ ${count("skip")} · ให้คนตรวจ ${count("manual")} · N/A ${count("na")} จาก ${results.length} เคส**\n\n`;
  md += `| TC ID | ผล | Actual Result | หลักฐาน |\n|---|---|---|---|\n`;
  for (const r of results) md += `| ${r.id} | ${STATUS_TH[r.status]} | ${actualOf(r).replace(/\|/g, "/")} | ${evidenceOf(r)} |\n`;
  md += `\n## รายละเอียดรายเคส\n`;
  for (const r of results) {
    md += `\n### ${r.id} — ${STATUS_TH[r.status]}\n\n`;
    for (const c of r.checks) md += `- ${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}\n`;
    if (r.error) md += `- ✗ error: ${r.error}\n`;
    for (const n of r.notes) md += `- หมายเหตุ: ${n}\n`;
    const reqs = r.requests.map((q) => `${q.method} ${q.path} → ${q.failed || q.status}`);
    if (reqs.length) md += `- request: ${reqs.join(" · ")}\n`;
  }
  await fs.writeFile(path.join(OUT, "ui-api-results.md"), md);

  const csvCell = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = ["TC ID,Actual Result,Status,Bug ID / Evidence", ...results.map((r) => [r.id, actualOf(r), STATUS_SHEET[r.status], evidenceOf(r)].map(csvCell).join(","))].join("\r\n");
  await fs.writeFile(path.join(OUT, "ui-api-results.csv"), "﻿" + csv);
  await fs.writeFile(path.join(OUT, "ui-api-results.json"), JSON.stringify({
    ranAt: stamp, ui: UI, api: API, browser: browserName, created: R,
    results: results.map((r) => ({ id: r.id, status: STATUS_SHEET[r.status], actual: actualOf(r), evidence: evidenceOf(r), checks: r.checks, error: r.error, notes: r.notes,
      requests: r.requests.map(({ json, ...q }) => q), console: r.console, dialogs: r.dialogs })),
  }, null, 2));
  console.log(`\nผ่าน ${count("pass")} · ไม่ผ่าน ${count("fail")} · รันไม่ได้ ${count("skip")} · ให้คนตรวจ ${count("manual")} · N/A ${count("na")} จาก ${results.length} เคส`);
  console.log(`ผลอยู่ที่ ${path.relative(process.cwd(), OUT)}${path.sep}ui-api-results.md (ส่งไฟล์ ui-api-results.json ให้ Scrum Master กรอกตาราง)`);
  process.exitCode = count("fail") ? 1 : 0;
}

main().catch(async (e) => {
  console.error("\nหยุดทำงาน: " + e.message);
  try { if (results.length) await writeReports(); } catch { /* ignore */ }
  try { await browser?.close(); } catch { /* ignore */ }
  process.exit(2);
});
