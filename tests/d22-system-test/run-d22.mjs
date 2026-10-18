// D22 · System Test (Sprint 1) · ระบบแจ้งซ่อมหอพัก CS261 กลุ่ม 3
// รันตามเอกสาร "System Test · Sprint 1 ระบบแจ้งซ่อมหอพัก" ครบ 30 เคส + E2E 7 ขั้น
// ทดสอบแบบ black-box ผ่านหน้าเว็บเหมือนผู้ใช้จริง (ดูข้อความที่มองเห็นบนจอ) แล้วเช็กข้อมูลในฐานข้อมูลจริง
// ด้วย sqlcmd ใน container db
//
// วิธีรัน (ระบบต้องรันอยู่ด้วย docker compose up -d และควรเริ่มจากฐานข้อมูลตั้งต้น):
//   cd tests/d22-system-test
//   npm install
//   node run-d22.mjs
//   node run-d22.mjs --headed     เปิดหน้าต่างเบราว์เซอร์ให้ดูตอนรัน
// ผลอยู่ใน results/<วันที่_เวลา>/ : d22-results.md, d22-results.json และรูปหลักฐานรายเคส ST-xx-xx.png

import { chromium } from "playwright-core";
import fs from "node:fs/promises";
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

const UI = (process.env.UI_URL || "http://localhost:3000").replace(/\/$/, "");
const API = (process.env.API_URL || "http://localhost:8080").replace(/\/$/, "");
const DB_PASSWORD = process.env.DB_PASSWORD || "DormRepair#2569";
const HEADED = process.argv.includes("--headed");
const PASSWORD = "password123";

const STATUS_TH = { PENDING: "รอรับเรื่อง", IN_PROGRESS: "กำลังดำเนินการ", COMPLETED: "เสร็จสิ้น" };
const CATEGORY_TH = { ELECTRICAL: "ไฟฟ้า", PLUMBING: "ประปา", AIR_CONDITIONER: "เครื่องปรับอากาศ", FURNITURE: "เฟอร์นิเจอร์", OTHER: "อื่นๆ" };
const SLOT_TH = { MORNING: "ช่วงเช้า", AFTERNOON: "ช่วงบ่าย" };
const AREA_TH = { ROOM: "ห้องพัก", COMMON_AREA: "พื้นที่ส่วนกลาง" };

// ข้อมูลตั้งต้นของ U1 ตามเอกสาร
const BASE = {
  building: "อาคาร A",
  location: "ชั้น 3 ห้อง 305",
  category: "ELECTRICAL",
  equipment: "ทดสอบไฟดับ",
  description: "หลอดไฟห้องน้ำไม่ติด",
  phone: "081-234-5678",
};

// ---------------------------------------------------------------- utils
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function bangkokDate(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function thaiDate(iso) { // 2026-10-18 → 18/10/2569
  if (!iso || iso === "NULL") return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
}
function thaiDateTime(s) { // 2026-10-14 13:00 → 14/10/2569 · 13:00
  return `${thaiDate(s)} · ${s.slice(11, 16)}`;
}
const YESTERDAY = bangkokDate(-1);
const TOMORROW = bangkokDate(1);
const DAY_AFTER = bangkokDate(2);
const isApi = (res, method, p) => {
  const u = new URL(res.url());
  return res.request().method() === method && u.origin === API && (typeof p === "string" ? u.pathname === p : p.test(u.pathname));
};
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

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

// ---------------------------------------------------------------- database (sqlcmd ใน container db)
// ข้อความไทยในฐานข้อมูลอ่านผ่าน console ของ Windows แล้วเพี้ยน จึงแปลงเป็น hex ใน SQL แล้วถอดเป็น UTF-16 ที่นี่
const HEX = (col) => `CONVERT(VARCHAR(MAX), CONVERT(VARBINARY(MAX), ${col}), 2)`;
const th = (hex) => (!hex || hex === "NULL" ? null : Buffer.from(hex, "hex").toString("utf16le"));
const dbLog = [];

function sql(query) {
  const args = ["compose", "exec", "-T", "db", "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost", "-U", "sa", "-P", DB_PASSWORD,
    "-C", "-d", "dorm_repair", "-h", "-1", "-W", "-s", "|", "-b", "-Q", "SET NOCOUNT ON; " + query];
  const r = spawnSync("docker", args, { cwd: PROJECT_ROOT, encoding: "utf8", timeout: 60000 });
  if (r.error) throw new Error("เรียก docker ไม่ได้: " + r.error.message);
  if (r.status !== 0) throw new Error("sqlcmd error: " + `${r.stdout || ""}${r.stderr || ""}`.trim().split("\n").slice(-2).join(" "));
  const rows = r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((l) => l.split("|"));
  dbLog.push(query.replace(/\s+/g, " ").slice(0, 140));
  return rows;
}
function dbMax() {
  const [[max, count]] = sql("SELECT ISNULL(MAX(request_id), 0), COUNT(*) FROM repair_requests");
  return { max: Number(max), count: Number(count) };
}
function dbRow(id) {
  const rows = sql(`SELECT r.request_id, r.resident_id, r.status, r.urgency, r.location_type, r.category, ${HEX("r.title")}, ${HEX("r.building")}, ${HEX("r.location_detail")}, ${HEX("r.description")}, CONVERT(VARCHAR(10), r.preferred_date_1, 23), r.preferred_slot_1, ISNULL(CONVERT(VARCHAR(10), r.preferred_date_2, 23), 'NULL'), ISNULL(r.preferred_slot_2, 'NULL'), ISNULL(CONVERT(VARCHAR(16), r.appointment_datetime, 120), 'NULL'), r.contact_phone, ISNULL(r.line_id, 'NULL'), CONVERT(VARCHAR(10), r.created_at, 23), CONVERT(VARCHAR(10), r.updated_at, 23), ISNULL(${HEX("t.full_name")}, 'NULL'), ISNULL(t.phone, 'NULL'), (SELECT COUNT(*) FROM request_images i WHERE i.request_id = r.request_id), (SELECT COUNT(*) FROM request_status_history h WHERE h.request_id = r.request_id) FROM repair_requests r LEFT JOIN users t ON t.user_id = r.technician_id WHERE r.request_id = ${Number(id)}`);
  if (!rows.length) return null;
  const c = rows[0];
  const n = (v) => (v === "NULL" ? null : v);
  return {
    requestId: Number(c[0]), residentId: Number(c[1]), status: c[2], urgency: c[3], locationType: c[4], category: c[5],
    title: th(c[6]), building: th(c[7]), locationDetail: th(c[8]), description: th(c[9]),
    date1: c[10], slot1: c[11], date2: n(c[12]), slot2: n(c[13]), appointment: n(c[14]),
    phone: c[15], lineId: n(c[16]), createdAt: c[17], updatedAt: c[18], techName: th(c[19]), techPhone: n(c[20]),
    images: Number(c[21]), history: Number(c[22]),
  };
}
function dbList(residentId) {
  return sql(`SELECT r.request_id, r.status, r.category, CONVERT(VARCHAR(10), r.created_at, 23), CONVERT(VARCHAR(10), r.updated_at, 23), ISNULL(${HEX("t.full_name")}, 'NULL') FROM repair_requests r LEFT JOIN users t ON t.user_id = r.technician_id WHERE r.resident_id = ${Number(residentId)} ORDER BY r.created_at DESC`)
    .map((c) => ({ requestId: Number(c[0]), status: c[1], category: c[2], createdAt: c[3], updatedAt: c[4], techName: th(c[5]) }));
}
function dbUserName(username) {
  const rows = sql(`SELECT ${HEX("full_name")} FROM users WHERE username = '${username.replace(/[^a-z0-9_]/gi, "")}'`);
  return rows.length ? th(rows[0][0]) : null;
}
function dbSetInProgress(id) {
  const rows = sql(`UPDATE repair_requests SET status = 'IN_PROGRESS' WHERE request_id = ${Number(id)} AND status = 'PENDING'; SELECT @@ROWCOUNT`);
  return Number(rows.at(-1)?.[0] || 0);
}
const rowSummary = (r) => r ? `#${r.requestId} resident ${r.residentId} · ${r.status} · ${r.urgency} · ${r.locationType} · "${r.title}" · slot2 ${r.date2 || "NULL"}/${r.slot2 || "NULL"} · appointment ${r.appointment || "NULL"} · line ${r.lineId || "NULL"} · images ${r.images} · history ${r.history}` : "ไม่พบแถว";

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
  throw new Error("เปิดเบราว์เซอร์ไม่ได้: ต้องมี Google Chrome หรือ Microsoft Edge ในเครื่อง");
}

async function makeFixtures() {
  await fs.mkdir(FIX, { recursive: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent("<canvas id=c width=640 height=480></canvas>");
  const jpeg = async (label, color) => Buffer.from(await page.evaluate(([label, color]) => {
    const c = document.getElementById("c");
    const g = c.getContext("2d");
    g.fillStyle = color; g.fillRect(0, 0, 640, 480);
    g.fillStyle = "#fff"; g.font = "bold 48px sans-serif"; g.fillText(label, 40, 120);
    g.font = "28px sans-serif"; g.fillText("รูปทดสอบ D22 System Test", 40, 180);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  }, [label, color]), "base64");
  const colors = ["#087f78", "#2563eb", "#b45309", "#9333ea"];
  for (let i = 1; i <= 4; i++) await fs.writeFile(path.join(FIX, `small${i}.jpg`), await jpeg(`small${i}.jpg`, colors[i - 1]));
  const big = await jpeg("large.jpg 5.5MB", "#b91c1c");
  await fs.writeFile(path.join(FIX, "large.jpg"), Buffer.concat([big, Buffer.alloc(Math.round(5.5 * 1048576) - big.length, 0)]));
  await fs.writeFile(path.join(FIX, "file.pdf"), "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  await ctx.close();
}
const fx = (name) => path.join(FIX, name);

// ---------------------------------------------------------------- case runner
const results = [];
const state = {};

async function newSession() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "th-TH", timezoneId: "Asia/Bangkok" });
  return { ctx, page: await ctx.newPage() };
}

function attach(page, rec) {
  const map = new Map();
  const onReq = (req) => {
    if (!req.url().startsWith(API) || req.url().startsWith(API + "/uploads/")) return;
    const u = new URL(req.url());
    const e = { method: req.method(), path: u.pathname, auth: !!req.headers()["authorization"], status: null, failed: null };
    map.set(req, e);
    rec.requests.push(e);
  };
  const onRes = (res) => { const e = map.get(res.request()); if (e) e.status = res.status(); };
  const onFail = (req) => { const e = map.get(req); if (e) e.failed = req.failure()?.errorText || "failed"; };
  const onConsole = (msg) => {
    if (msg.type() !== "error") return;
    const src = msg.location()?.url || "";
    if (/favicon/i.test(msg.text() + src) || (src && !src.startsWith(UI) && !src.startsWith(API))) return;
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
  const rec = { id, title, status: "fail", checks: [], notes: [], actual: [], steps: [], requests: [], console: [], dialogs: [], db: [], error: null };
  const s = session || (await newSession());
  const detach = attach(s.page, rec);
  const logStart = dbLog.length;
  const t = {
    page: s.page, ctx: s.ctx, rec,
    check: (name, ok, detail = "") => { rec.checks.push({ name, ok: !!ok, detail: String(detail ?? "") }); return !!ok; },
    note: (text) => rec.notes.push(text),
    actual: (text) => rec.actual.push(text),
  };
  try {
    await fn(t);
  } catch (e) {
    rec.error = e.message.split("\n")[0];
  }
  await sleep(200);
  detach();
  rec.db = dbLog.slice(logStart);
  rec.status = !rec.error && rec.checks.length && rec.checks.every((c) => c.ok) ? "pass" : "fail";
  try { await evidence(s.page, rec); } catch (e) { rec.notes.push("แคปหน้าจอไม่สำเร็จ: " + e.message); }
  if (!keep) await s.ctx.close();
  results.push(rec);
  const mark = rec.status === "pass" ? "✓ ผ่าน    " : "✗ ไม่ผ่าน ";
  const why = rec.status === "fail" ? "  ← " + (rec.error || rec.checks.find((c) => !c.ok)?.name || "") : "";
  console.log(`${mark} ${id}  ${title}${why}`);
  return s;
}

// ---------------------------------------------------------------- page helpers
async function text(page, sel) {
  const loc = page.locator(sel).first();
  if (!(await loc.count())) return null;
  return norm(await loc.innerText());
}
async function shown(page, sel) {
  const loc = page.locator(sel).first();
  return (await loc.count()) ? loc.isVisible() : false;
}
/** มีข้อความนี้ "มองเห็นได้" บนจอไหม (ไม่สนว่าอยู่ใน element ไหน) */
async function visibleText(page, words) {
  const loc = page.getByText(words, { exact: false });
  const n = await loc.count();
  for (let i = 0; i < n; i++) if (await loc.nth(i).isVisible()) return true;
  return false;
}
/** ข้อความเตือนสีแดงที่มองเห็นอยู่ทั้งหมด + alert */
async function visibleErrors(page, rec) {
  const texts = await page.$$eval(".error-msg, [role=alert], .notice--danger", (els) => els
    .filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== "hidden" && e.textContent.trim())
    .map((e) => e.textContent.trim()));
  return [...new Set(texts.concat(rec?.dialogs || []))];
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
async function login(page, username) {
  const res = await loginUI(page, username);
  if (res.status() !== 200) throw new Error(`login ${username} ไม่สำเร็จ (${res.status()})`);
  await page.waitForURL(/home\.html/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}
async function openHistory(page) {
  await Promise.all([page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/my"), { timeout: 15000 }), page.goto(UI + "/pages/history.html")]);
  await page.waitForFunction(() => !/กำลังโหลด/.test(document.getElementById("result-count")?.textContent || ""));
}
async function historyItems(page) {
  return page.$$eval("#request-list li", (lis) => lis.map((li) => {
    const badge = li.querySelector(".badge");
    return {
      title: li.querySelector("h3")?.textContent.trim() || "",
      meta: li.querySelector("p")?.textContent.trim() || "",
      status: badge?.textContent.trim() || "",
      bg: badge ? getComputedStyle(badge).backgroundColor : "",
    };
  }));
}
const idOf = (meta) => Number((meta.match(/#(\d+)/) || [])[1]);

async function openForm(page, user = "resident01") {
  await login(page, user);
  await page.click("#new-request-link");
  await page.waitForURL(/repair-form\.html/);
  await page.waitForSelector("#repair-form");
}
async function fillForm(page, o = {}) {
  const v = { ...BASE, common: false, date1: TOMORROW, slot1: "MORNING", date2: "", slot2: "", lineId: "", images: ["small1.jpg"], ...o };
  await page.check(v.common ? "#area-common" : "#area-room");
  await page.selectOption("#building", v.building);
  await page.fill("#location", v.location);
  await page.selectOption("#category", v.category);
  await page.fill("#equipment", v.equipment);
  await page.fill("#description", v.description);
  await page.fill("#preferred-date-1", v.date1);
  await page.selectOption("#preferred-time-1", v.slot1);
  if (v.date2) await page.fill("#preferred-date-2", v.date2);
  if (v.slot2) await page.selectOption("#preferred-time-2", v.slot2);
  await page.fill("#phone", v.phone);
  if (v.lineId) await page.fill("#line-id", v.lineId);
  if (v.images.length) await page.setInputFiles("#images", v.images.map(fx));
  return v;
}
async function submitOk(page) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => isApi(r, "POST", "/api/repair-requests"), { timeout: 20000 }),
    page.click("#submit-btn"),
  ]);
  if (res.status() !== 201) throw new Error(`ส่งคำร้องไม่สำเร็จ (${res.status()})`);
  await page.waitForURL(/repair-success\.html\?id=\d+/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  return Number(new URL(page.url()).searchParams.get("id"));
}
const posts = (rec) => rec.requests.filter((r) => r.method === "POST" && r.path === "/api/repair-requests");

/** เคสที่ต้องเตือนและห้ามส่ง: กดส่ง → ต้องเห็นข้อความ, ไม่มี POST, ไม่ไปหน้าสำเร็จ, DB ไม่มีแถวใหม่ */
async function expectBlocked(t, expectedText, before) {
  const { page, check, actual, rec } = t;
  await page.click("#submit-btn");
  await sleep(900);
  const errs = await visibleErrors(page, rec);
  const after = dbMax();
  if (expectedText) {
    const seen = await visibleText(page, expectedText);
    check(`เห็นข้อความเตือน "${expectedText}"`, seen, errs.length ? "ข้อความที่เห็น: " + errs.join(" / ") : "ไม่มีข้อความเตือนบนจอ");
  }
  check("ไม่ไปหน้าส่งสำเร็จ", page.url().includes("repair-form.html"), page.url());
  check("ไม่มีการส่งข้อมูลไป backend", posts(rec).length === 0, `POST ${posts(rec).length} ครั้ง`);
  check("DB ไม่มีแถวใหม่", after.max === before.max && after.count === before.count, `ก่อน ${before.count} แถว (max ${before.max}) · หลัง ${after.count} แถว (max ${after.max})`);
  actual(`ข้อความบนจอ: ${errs.length ? errs.map((e) => `"${e}"`).join(", ") : "ไม่มี"} · POST ${posts(rec).length} ครั้ง · DB ${after.count - before.count === 0 ? "ไม่มีแถวใหม่" : `เพิ่ม ${after.count - before.count} แถว`}`);
}

// ---------------------------------------------------------------- evidence image
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
async function evidence(page, rec) {
  await fs.mkdir(RAW, { recursive: true });
  let shot = null;
  if (!page.isClosed() && page.url() !== "about:blank") shot = await page.screenshot({ path: path.join(RAW, `${rec.id}-page.png`), fullPage: true });
  const reqRows = rec.requests.map((r) => {
    const st = r.failed ? `<b class=bad>${esc(r.failed)}</b>` : r.status == null ? "-" : `<b class=${r.status < 400 ? "good" : "warn"}>${r.status}</b>`;
    return `<tr><td>${r.method}</td><td class=mono>${esc(r.path)}</td><td>${st}</td><td>${r.auth ? "Bearer ✓" : "–"}</td></tr>`;
  }).join("");
  const checks = rec.checks.map((c) => `<li class=${c.ok ? "good" : "bad"}>${c.ok ? "✓" : "✗"} ${esc(c.name)}${c.detail ? ` <span class=small>— ${esc(c.detail)}</span>` : ""}</li>`).join("");
  const label = rec.status === "pass" ? "ผ่าน" : "ไม่ผ่าน";
  const html = `<!doctype html><meta charset=utf-8><style>
    body{margin:0;font-family:Sarabun,"Leelawadee UI",Tahoma,sans-serif;background:#f3f5f7;color:#16202a}
    .wrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;padding:16px;width:1700px;box-sizing:border-box}
    .shot{background:#fff;border:1px solid #d0d7de;border-radius:8px;overflow:hidden}.shot img{width:100%;display:block}
    .panel{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:14px 16px}
    h1{font-size:22px;margin:0 0 4px}.tag{display:inline-block;padding:2px 10px;border-radius:99px;font-size:14px;color:#fff}
    .pass{background:#15803d}.fail{background:#b91c1c}
    h2{font-size:15px;margin:14px 0 6px;color:#475569}table{border-collapse:collapse;width:100%;font-size:13px}
    td,th{border-bottom:1px solid #e5e7eb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f8fafc}
    .mono{font-family:Consolas,monospace}.small{font-size:12px;color:#475569}ul{margin:0;padding-left:0;list-style:none;font-size:14px}
    li{margin:3px 0}.good{color:#15803d}.bad{color:#b91c1c}.warn{color:#b45309}.meta{font-size:12px;color:#64748b}
  </style><div class=wrap><div class=shot>${shot ? `<img src="data:image/png;base64,${shot.toString("base64")}">` : "<p style='padding:16px'>ไม่มีภาพหน้าเว็บ</p>"}</div>
  <div class=panel><h1>${esc(rec.id)} <span class="tag ${rec.status}">${label}</span></h1><div>${esc(rec.title)}</div>
  <div class=meta>${esc(new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }))} · ${esc(browserName)} · URL ${esc(page.isClosed() ? "" : page.url())}</div>
  <h2>Network → backend</h2><table><tr><th>Method</th><th>Path</th><th>Status</th><th>Auth</th></tr>${reqRows || "<tr><td colspan=4>ไม่มี request</td></tr>"}</table>
  ${rec.db.length ? `<h2>ตรวจฐานข้อมูล (sqlcmd)</h2><ul class=small>${rec.db.map((q) => `<li class=mono>${esc(q)}…</li>`).join("")}</ul>` : ""}
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

// ================================================================ U2
async function u2Cases() {
  await runCase("ST-U2-01", "เข้าสู่ระบบสำเร็จ", async ({ page, check, actual }) => {
    await login(page, "resident01");
    const name = await text(page, "#user-name");
    const room = await text(page, "#user-room");
    check("ไปหน้าโฮม", page.url().includes("home.html"), page.url());
    check('แสดงชื่อผู้ใช้ "สมชาย ใจดี"', name === "สมชาย ใจดี", name);
    check("แสดงห้อง A-305", room === "A-305", room);
    actual(`ไปหน้าโฮม · ชื่อ "${name}" · ห้อง "${room}"`);
  });

  for (const [id, title, user, pass] of [["ST-U2-02", "รหัสผ่านผิด", "resident01", "wrongpass"], ["ST-U2-03", "ชื่อผู้ใช้ไม่มีในระบบ", "nobody", "1234"]]) {
    await runCase(id, title, async ({ page, check, actual, rec }) => {
      await loginUI(page, user, pass);
      await sleep(500);
      const seen = await visibleText(page, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      const errs = await visibleErrors(page, rec);
      check('ขึ้น "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"', seen, errs.join(" / ") || "ไม่มีข้อความบนจอ");
      check("ยังอยู่หน้า Login", page.url().includes("login.html"), page.url());
      if (id === "ST-U2-03") check("ไม่บอกว่าผิดช่องไหน", !errs.some((e) => /ไม่มีผู้ใช้|ไม่พบผู้ใช้|ชื่อผู้ใช้ผิด|รหัสผ่านผิด/.test(e)), errs.join(" / "));
      actual(`ข้อความบนจอ: ${errs.map((e) => `"${e}"`).join(", ") || "ไม่มี"} · อยู่หน้า Login`);
    });
  }

  await runCase("ST-U2-04", "ไม่กรอกอะไร", async ({ page, check, actual, rec }) => {
    await page.goto(UI + "/pages/login.html");
    await page.click("#login-btn");
    await sleep(600);
    const seen = await visibleText(page, "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    const native = await page.$eval("#username", (el) => el.validationMessage);
    const errs = await visibleErrors(page, rec);
    check('ขึ้น "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"', seen, errs.join(" / ") || (native ? `เบราว์เซอร์เตือนเองว่า "${native}" แทน` : "ไม่มีข้อความ"));
    check("ไม่มีการส่งข้อมูลไป backend", !rec.requests.some((r) => r.path === "/api/auth/login"));
    actual(errs.length ? `ข้อความบนจอ: ${errs.map((e) => `"${e}"`).join(", ")}` : native ? `เบราว์เซอร์เตือนเอง "${native}" (ไม่เห็นข้อความของระบบ)` : "ไม่มีข้อความเตือน");
  });

  const s = await runCase("ST-U2-05", "ออกจากระบบ", async ({ page, check, actual }) => {
    await login(page, "resident01");
    await page.click("#logout-btn");
    await page.waitForURL(/login\.html/, { timeout: 10000 }).catch(() => {});
    check("กลับหน้า Login", page.url().includes("login.html"), page.url());
    actual(`กดออกจากระบบ → ${new URL(page.url()).pathname}`);
  }, { keep: true });

  await runCase("ST-U2-06", "กลับเข้าหน้าเดิมหลัง logout", async ({ page, check, actual }) => {
    await page.goBack().catch(() => {});
    await sleep(800);
    const afterBack = new URL(page.url()).pathname;
    const backData = await page.locator("#latest-request .request-item, #request-list li").count();
    check("กด Back แล้วไม่เห็นข้อมูลเดิม", !afterBack.includes("home.html") || backData === 0, afterBack);
    await page.goto(UI + "/pages/home.html");
    await page.waitForURL(/login\.html/, { timeout: 10000 }).catch(() => {});
    await sleep(500);
    check("พิมพ์ URL หน้าโฮมแล้วเด้งกลับหน้า Login", page.url().includes("login.html"), page.url());
    check("ไม่เห็นข้อมูลเดิม", !(await visibleText(page, "สมชาย")), "");
    actual(`กด Back → ${afterBack} · พิมพ์ URL หน้าโฮม → ${new URL(page.url()).pathname}`);
  }, { session: s });

  await runCase("ST-U2-07", "เปิดหน้าในโดยไม่ login", async ({ page, check, actual }) => {
    await page.goto(UI + "/pages/history.html");
    await page.waitForURL(/login\.html/, { timeout: 10000 }).catch(() => {});
    check("เด้งไปหน้า Login", page.url().includes("login.html"), page.url());
    actual(`เปิด history.html ในหน้าต่างใหม่ที่ไม่เคย login → ${new URL(page.url()).pathname}`);
  });
}

// ================================================================ U3 (อ่านอย่างเดียว รันก่อน U1)
function expectedMeta(r) {
  const head = `#${r.requestId} · ${CATEGORY_TH[r.category]}`;
  if (r.status === "IN_PROGRESS") return `${head} · ช่าง ${r.techName || "ยังไม่มอบหมาย"}`;
  if (r.status === "COMPLETED") return `${head} · เสร็จ ${thaiDate(r.updatedAt)}`;
  return `${head} · แจ้งเมื่อ ${thaiDate(r.createdAt)}`;
}
function hue(rgb) {
  const [r, g, b] = (rgb.match(/\d+/g) || []).slice(0, 3).map((x) => Number(x) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return -1;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}
const HUE_OK = { PENDING: [35, 65, "เหลือง"], IN_PROGRESS: [190, 240, "ฟ้า"], COMPLETED: [90, 170, "เขียว"] };

async function u3ReadCases() {
  await runCase("ST-U3-01", "แสดงเฉพาะคำร้องของตัวเอง", async ({ page, check, actual, note }) => {
    const db = dbList(1);
    await login(page, "resident01");
    await openHistory(page);
    const items = await historyItems(page);
    const ids = items.map((i) => idOf(i.meta));
    check(`เห็นรายการเท่ากับใน DB ของ resident01 (${db.length} รายการ)`, items.length === db.length, `เว็บ ${items.length} / DB ${db.length}`);
    check("เรียงล่าสุดก่อน ตรงกับ DB (ORDER BY created_at DESC)", JSON.stringify(ids) === JSON.stringify(db.map((r) => r.requestId)), ids.map((x) => "#" + x).join(", "));
    check("ไม่เห็นคำร้องของ resident02 (#987)", !ids.includes(987));
    if (db.length !== 3) note(`ฐานข้อมูลไม่ได้อยู่สภาพตั้งต้น (resident01 มี ${db.length} คำร้อง) จึงเทียบกับ DB แทนเลข 3`);
    actual(`เห็น ${items.length} รายการ: ${ids.map((x) => "#" + x).join(", ")} · ไม่มี #987`);
  });

  await runCase("ST-U3-02", "ป้ายสถานะตรงกับ DB", async ({ page, check, actual }) => {
    const db = dbList(1);
    await login(page, "resident01");
    await openHistory(page);
    const items = await historyItems(page);
    const bad = [];
    const seen = {};
    items.forEach((it) => {
      const r = db.find((x) => x.requestId === idOf(it.meta));
      if (!r) return;
      const [lo, hi, color] = HUE_OK[r.status];
      const h = hue(it.bg);
      seen[r.status] = `"${it.status}" สี${color} (${it.bg})`;
      if (it.status !== STATUS_TH[r.status] || h < lo || h > hi) bad.push(`#${r.requestId} DB ${r.status} → เว็บ "${it.status}" สี ${it.bg}`);
    });
    check("ทุกรายการ ข้อความและสีป้ายตรงกับสถานะใน DB", bad.length === 0 && items.length > 0, bad.join(" | "));
    check("มีครบทั้ง 3 สถานะให้ตรวจ", Object.keys(seen).length === 3, Object.keys(seen).join(", "));
    actual(Object.entries(seen).map(([k, v]) => `${k} = ${v}`).join(" · "));
  });

  await runCase("ST-U3-05", "ผู้ใช้ที่ยังไม่มีคำร้อง", async ({ page, check, actual, rec }) => {
    await login(page, "resident03");
    await openHistory(page);
    const seen = await visibleText(page, "ยังไม่มีคำร้อง");
    const empty = await text(page, "#empty-state");
    check('แสดงข้อความ "ยังไม่มีคำร้อง"', seen, `ข้อความที่เห็น: "${(await shown(page, "#empty-state")) ? empty : ""}"`);
    check("ไม่ขึ้น error", rec.console.length === 0 && !rec.dialogs.length, rec.console.join(" | "));
    actual(`ข้อความบนจอ "${empty}" · Console error ${rec.console.length}`);
  });

  await runCase("ST-U3-06", "เปิดคำร้องของคนอื่น", async ({ page, check, actual }) => {
    await login(page, "resident01");
    const [res] = await Promise.all([page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/987")), page.goto(UI + "/pages/request-detail.html?id=987")]);
    await page.waitForLoadState("networkidle");
    const body = await page.locator("body").innerText();
    const msg = await visibleText(page, "ไม่พบคำร้อง");
    const descShown = await shown(page, "#request-description");
    const tlShown = await shown(page, "#timeline");
    check('ขึ้นข้อความว่าไม่พบคำร้อง (API ตอบ 404 ตาม API spec)', msg && res.status() === 404, `API ${res.status()}`);
    check("ไม่แสดงข้อมูลของ resident02", !/บานพับ|มานี|B-210/.test(body));
    check("ไม่แสดงส่วนรายละเอียดคำร้องเลย (ไม่มีข้อมูลค้างบนจอ)", !descShown && !tlShown, `ส่วนรายละเอียด${descShown ? "ยังแสดง" : "ซ่อน"} · ไทม์ไลน์${tlShown ? "ยังแสดง" : "ซ่อน"}`);
    actual(`API ${res.status()} · ${msg ? 'เห็น "ไม่พบคำร้อง"' : "ไม่มีข้อความ"} · ไม่เห็นข้อมูล resident02 · ส่วนรายละเอียด${descShown ? "ยังแสดงข้อมูลตัวอย่างจาก HTML" : "ถูกซ่อน"}`);
  });

  await runCase("ST-U3-07", "บรรทัดย่อยในหน้าประวัติ", async ({ page, check, actual }) => {
    const db = dbList(1);
    await login(page, "resident01");
    await openHistory(page);
    const items = await historyItems(page);
    const wrong = [];
    const shownLines = [];
    for (const it of items) {
      const r = db.find((x) => x.requestId === idOf(it.meta));
      if (!r) continue;
      const want = expectedMeta(r);
      if (norm(it.meta) !== want) wrong.push(`#${r.requestId} (${r.status}) ได้ "${it.meta}" ควรเป็น "${want}"`);
      if (!shownLines.some((l) => l.startsWith(r.status))) shownLines.push(`${r.status}: "${it.meta}"`);
    }
    check("บรรทัดย่อยแต่ละสถานะตรงตามที่ออกแบบ", wrong.length === 0 && items.length > 0, wrong.slice(0, 3).join(" | "));
    check("วันที่แสดงเป็น พ.ศ.", items.every((it) => !/\d{2}\/\d{2}\/20\d{2}/.test(it.meta)) && items.some((it) => /\/25\d{2}/.test(it.meta)));
    actual(shownLines.join(" · "));
  });

  await runCase("ST-U3-08", "รายละเอียดคำร้องที่ยังรอรับเรื่อง", async ({ page, check, actual }) => {
    const db = dbRow(1024);
    await login(page, "resident01");
    await openHistory(page);
    await page.locator("#request-list li a", { hasText: "#1024" }).click();
    await page.waitForURL(/request-check\.html\?id=1024/);
    await page.waitForLoadState("networkidle");
    await page.click("#detail-link");
    await page.waitForURL(/request-detail\.html\?id=1024/);
    await page.waitForLoadState("networkidle");
    const appt = await text(page, "#appointment-datetime");
    const tech = await text(page, "#technician-name");
    const urgent = await page.getByText("เร่งด่วน", { exact: true }).filter({ visible: true }).count().catch(() => 0);
    const tl = await page.locator("#timeline > li").count();
    check('นัดหมายเข้าซ่อม แสดง "รอเจ้าหน้าที่ยืนยันเวลานัด"', (appt || "").includes("รอเจ้าหน้าที่ยืนยันเวลานัด"), appt);
    check('ช่าง แสดง "ยังไม่มอบหมาย"', (tech || "").includes("ยังไม่มอบหมาย"), tech);
    check(`ไม่มีแท็กเร่งด่วน (DB urgency = ${db.urgency})`, urgent === 0 && db.urgency === "NORMAL", `แท็กที่เห็น ${urgent}`);
    check(`timeline มี ${db.history} ขั้นตาม DB (ออกแบบไว้ 1 ขั้น)`, tl === db.history && tl === 1, `${tl} ขั้น`);
    actual(`นัดหมาย "${appt}" · ช่าง "${tech}" · แท็กเร่งด่วน ${urgent ? "มี" : "ไม่มี"} · timeline ${tl} ขั้น`);
  });

  await runCase("ST-U3-09", "รายละเอียดคำร้องที่มอบหมายช่างแล้ว", async ({ page, check, actual }) => {
    const db = dbRow(1019);
    const staff = dbUserName("staff01");
    await login(page, "resident01");
    await openHistory(page);
    await page.locator("#request-list li a", { hasText: "#1019" }).click();
    await page.waitForURL(/request-check\.html\?id=1019/);
    await page.waitForLoadState("networkidle");
    await page.click("#detail-link");
    await page.waitForURL(/request-detail\.html\?id=1019/);
    await page.waitForLoadState("networkidle");
    const urgent = await page.getByText("เร่งด่วน", { exact: true }).filter({ visible: true }).count().catch(() => 0);
    const appt = await text(page, "#appointment-datetime");
    const tech = await text(page, "#technician-name");
    const phone = await text(page, "#technician-phone");
    const tl = await page.$$eval("#timeline > li", (lis) => lis.map((li) => {
      const n = li.querySelector("[data-field=note]");
      return n && n.offsetParent !== null ? n.textContent.trim() : "";
    }));
    const staffName = await text(page, "#staff-name");
    check(`มีแท็ก "เร่งด่วน" (DB urgency = ${db.urgency})`, urgent > 0 && db.urgency === "URGENT", `แท็กที่เห็น ${urgent}`);
    check(`วันเวลานัดตรงกับ appointment_datetime (${thaiDateTime(db.appointment)})`, appt === thaiDateTime(db.appointment), appt);
    check(`ช่าง ${db.techName} เบอร์ ${db.techPhone}`, tech === db.techName && phone === db.techPhone, `${tech} ${phone}`);
    check(`timeline ${db.history} ขั้นพร้อม note ใต้แต่ละขั้น`, tl.length === db.history && tl.every(Boolean), tl.map((n) => n || "(ไม่มี note)").join(" | "));
    check(`รับเรื่องโดย ชื่อของ staff01 (${staff})`, staffName === staff, staffName);
    actual(`แท็กเร่งด่วน ${urgent ? "มี" : "ไม่มี"} · นัด "${appt}" · ช่าง ${tech} ${phone} · timeline ${tl.length} ขั้น note ${tl.filter(Boolean).length} · รับเรื่องโดย "${staffName}"`);
  });

  await runCase("ST-U3-10", "เลขคำร้องที่ไม่มีในระบบ", async ({ page, check, actual }) => {
    await login(page, "resident01");
    const [res] = await Promise.all([page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/99999")), page.goto(UI + "/pages/request-detail.html?id=99999")]);
    await page.waitForLoadState("networkidle");
    const body = norm(await page.locator("body").innerText());
    const seen = await visibleText(page, "ไม่พบคำร้องนี้");
    check('ขึ้น "ไม่พบคำร้องนี้"', seen, (await text(page, "#not-found")) || "");
    check("ไม่ขึ้นหน้าว่างหรือ error ของเบราว์เซอร์", body.length > 20 && !/\bundefined\b|\bnull\b/.test(body) && page.url().includes("request-detail.html"));
    actual(`API ${res.status()} · ข้อความบนจอ "${(await text(page, "#not-found")) || ""}"`);
  });
}

// ================================================================ U1
async function u1Cases() {
  const s1 = await runCase("ST-U1-01", "ส่งคำร้องข้อมูลครบ", async ({ page, check, actual }) => {
    await openForm(page);
    await fillForm(page);
    const id = await submitOk(page);
    state.u1First = id;
    const card = norm(await page.locator(".success-summary").innerText());
    const rid = await text(page, "#request-id");
    check(`ขึ้นหน้าส่งสำเร็จ มีเลข #${id}`, rid === "#" + id, rid);
    check("สถานะ รอรับเรื่อง", card.includes("รอรับเรื่อง"));
    check(`แสดง "ช่วงเวลาที่สะดวก" ${thaiDate(TOMORROW)} ช่วงเช้า`, card.includes("ช่วงเวลาที่สะดวก") && card.includes(thaiDate(TOMORROW)) && card.includes("ช่วงเช้า"), card);
    check('ไม่ใช้คำว่า "นัดหมาย"', !card.includes("นัดหมาย"), card);
    const r = dbRow(id);
    check("DB: repair_requests 1 แถว status = PENDING, urgency = NORMAL", r && r.status === "PENDING" && r.urgency === "NORMAL", rowSummary(r));
    check(`DB: title = ${BASE.equipment}, location_type = ROOM`, r && r.title === BASE.equipment && r.locationType === "ROOM", `${r?.title} / ${r?.locationType}`);
    check("DB: appointment_datetime และ preferred_date_2 เป็น NULL", r && r.appointment === null && r.date2 === null);
    check("DB: request_images 1 แถว · request_status_history 1 แถว", r && r.images === 1 && r.history === 1, `images ${r?.images} · history ${r?.history}`);
    actual(`หน้าส่งสำเร็จ: "${card}" · DB: ${rowSummary(r)}`);
  }, { keep: true });
  await s1.ctx.close();

  await runCase("ST-U1-02", "ไม่กรอกช่องบังคับ", async (t) => {
    await openForm(t.page);
    await fillForm(t.page, { equipment: "" });
    await expectBlocked(t, "กรุณากรอกข้อมูลให้ครบ", dbMax());
  });

  await runCase("ST-U1-03", "ไม่แนบรูป", async (t) => {
    await openForm(t.page);
    await fillForm(t.page, { images: [] });
    await expectBlocked(t, "กรุณาแนบรูปภาพอย่างน้อย 1 รูป", dbMax());
  });

  await runCase("ST-U1-04", "แนบครบ 3 รูป (ขอบบน)", async ({ page, check, actual }) => {
    await openForm(page);
    await fillForm(page, { images: ["small1.jpg", "small2.jpg", "small3.jpg"] });
    const id = await submitOk(page);
    const r = dbRow(id);
    check("ส่งสำเร็จ", page.url().includes("repair-success.html"));
    check("DB: request_images 3 แถว", r && r.images === 3, `images ${r?.images}`);
    actual(`ส่งสำเร็จ #${id} · DB request_images ${r?.images} แถว`);
  });

  await runCase("ST-U1-05", "แนบเกิน 3 รูป", async (t) => {
    await openForm(t.page);
    await fillForm(t.page, { images: [] });
    await t.page.setInputFiles("#images", ["small1.jpg", "small2.jpg", "small3.jpg", "small4.jpg"].map(fx));
    await sleep(300);
    const warned = await visibleText(t.page, "แนบรูปได้ไม่เกิน 3 รูป");
    t.check('เลือกรูปที่ 4 แล้วเห็น "แนบรูปได้ไม่เกิน 3 รูป" ทันที', warned, (await visibleErrors(t.page, t.rec)).join(" / ") || "ไม่มีข้อความเตือนบนจอ");
    t.actual(`ตอนเลือก 4 รูป: ${warned ? 'เห็น "แนบรูปได้ไม่เกิน 3 รูป"' : "ไม่มีข้อความเตือน"}`);
    // กดส่งต่อ: ต้องส่งไม่ได้ และยังเห็นเหตุผลเดิม
    await expectBlocked(t, "แนบรูปได้ไม่เกิน 3 รูป", dbMax());
  });

  await runCase("ST-U1-06", "รูปใหญ่เกิน 5MB", async (t) => {
    await openForm(t.page);
    await fillForm(t.page, { images: ["large.jpg"] });
    await expectBlocked(t, "รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB", dbMax());
  });

  await runCase("ST-U1-07", "ไฟล์ไม่ใช่รูป", async (t) => {
    await openForm(t.page);
    await fillForm(t.page, { images: ["file.pdf"] });
    await expectBlocked(t, "รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB", dbMax());
  });

  await runCase("ST-U1-08", "วันที่สะดวกเป็นอดีต", async (t) => {
    await openForm(t.page);
    await fillForm(t.page, { date1: YESTERDAY });
    await expectBlocked(t, "กรุณาเลือกวันเวลาในอนาคต", dbMax());
  });

  await runCase("ST-U1-09", "พื้นที่ส่วนกลาง + ช่วงที่ 2 + LINE", async ({ page, check, actual }) => {
    await openForm(page);
    await fillForm(page, { common: true, location: "ห้องซักรีดชั้น 1", date2: DAY_AFTER, slot2: "AFTERNOON", lineId: "test305" });
    const id = await submitOk(page);
    state.u1Full = id;
    const r = dbRow(id);
    check("ส่งสำเร็จ", page.url().includes("repair-success.html"));
    check("DB: location_type = COMMON_AREA", r?.locationType === "COMMON_AREA", r?.locationType);
    check(`DB: preferred_date_2 = ${DAY_AFTER} (มะรืน), preferred_slot_2 = AFTERNOON`, r?.date2 === DAY_AFTER && r?.slot2 === "AFTERNOON", `${r?.date2} ${r?.slot2}`);
    check("DB: line_id = test305", r?.lineId === "test305", r?.lineId);
    actual(`ส่งสำเร็จ #${id} · DB: ${rowSummary(r)}`);
  });

  // ST-U3-04 ต้องใช้ "รายการบนสุด" ซึ่งตอนนี้คือคำร้องจาก ST-U1-09 (มีครบทุกช่อง: พื้นที่ส่วนกลาง ช่วงที่ 2 LINE)
  await runCase("ST-U3-04", "ดูรายละเอียดคำร้อง", async ({ page, check, actual, note }) => {
    await login(page, "resident01");
    await openHistory(page);
    const top = idOf((await historyItems(page))[0]?.meta || "");
    const r = dbRow(top);
    await page.locator("#request-list li a").first().click();
    await page.waitForURL(/request-check\.html/);
    await page.waitForLoadState("networkidle");
    const v = {
      code: await text(page, "#request-code"), area: await text(page, "#area-type"), loc: await text(page, "#location"),
      cat: await text(page, "#category"), equip: await text(page, "#equipment"), desc: await text(page, "#description"),
      times: await text(page, "#preferred-times"), contact: await text(page, "#contact-info"),
    };
    const imgsCheck = await page.locator("#image-list img").count();
    const wantTimes = [`${thaiDate(r.date1)} · ${SLOT_TH[r.slot1]}`].concat(r.date2 ? [`${thaiDate(r.date2)} · ${SLOT_TH[r.slot2]}`] : []).join(" / ");
    const bad = [];
    const eq = (label, got, want) => { if (got !== want) bad.push(`${label}: เว็บ "${got}" DB "${want}"`); };
    eq("เลขคำร้องและวันที่แจ้ง", v.code, `เลขคำร้อง #${r.requestId} · แจ้งเมื่อ ${thaiDate(r.createdAt)}`);
    eq("ประเภทพื้นที่", v.area, AREA_TH[r.locationType]);
    eq("สถานที่ (อาคาร จุดที่พบ)", v.loc, `${r.building} ${r.locationDetail}`);
    eq("หมวด", v.cat, CATEGORY_TH[r.category]);
    eq("อุปกรณ์ที่ชำรุด", v.equip, r.title);
    eq("รายละเอียด", v.desc, r.description);
    eq("ช่วงเวลาที่สะดวก", v.times, wantTimes);
    if (!(v.contact || "").includes(r.phone)) bad.push(`เบอร์โทร: เว็บ "${v.contact}" DB "${r.phone}"`);
    if (r.lineId && !(v.contact || "").includes(r.lineId)) bad.push(`LINE: เว็บ "${v.contact}" DB "${r.lineId}"`);
    if (imgsCheck !== r.images) bad.push(`รูป: เว็บ ${imgsCheck} DB ${r.images}`);
    await page.click("#detail-link");
    await page.waitForURL(/request-detail\.html/);
    await page.waitForLoadState("networkidle");
    const tl = await page.locator("#timeline > li").count();
    const imgsDetail = await page.locator("#image-list img").count();
    if (tl !== r.history) bad.push(`ประวัติสถานะ: เว็บ ${tl} DB ${r.history}`);
    if (imgsDetail !== r.images) bad.push(`รูป (หน้ารายละเอียด): เว็บ ${imgsDetail} DB ${r.images}`);
    check("ทุกช่องตรงกับ DB (เลข สถานที่ หมวด อุปกรณ์ รายละเอียด วันที่แจ้ง ช่วงเวลา 1–2 ช่วง เบอร์/LINE รูป ประวัติสถานะ)", bad.length === 0, bad.join(" | "));
    note(`รายการบนสุดคือ #${top} ที่สร้างใน ST-U1-09 จึงตรวจได้ครบทั้งช่วงที่ 2 และ LINE · ข้อมูลอยู่ 2 หน้า: ตรวจสอบคำร้อง (ข้อมูลที่แจ้ง) และรายละเอียด (ประวัติสถานะ)`);
    actual(`#${top}: ${v.area} · ${v.loc} · ${v.cat} · ${v.equip} · "${v.times}" · "${v.contact}" · รูป ${imgsCheck} · ประวัติ ${tl} ขั้น${bad.length ? " · ไม่ตรง: " + bad.join(", ") : " · ตรงกับ DB ทุกช่อง"}`);
  });

  await runCase("ST-U1-10", "ช่วงที่ 2 กรอกไม่ครบคู่", async (t) => {
    await openForm(t.page);
    await fillForm(t.page, { date2: DAY_AFTER });
    await expectBlocked(t, "กรุณากรอกวันและช่วงเวลาเพิ่มเติมให้ครบ หรือเว้นว่างทั้งคู่", dbMax());
  });

  await runCase("ST-U1-11", "ช่วงที่ 2 ซ้ำช่วงแรก", async (t) => {
    await openForm(t.page);
    await fillForm(t.page, { date2: TOMORROW, slot2: "MORNING" });
    await expectBlocked(t, "ช่วงเวลาเพิ่มเติมต้องไม่ซ้ำกับช่วงแรก", dbMax());
  });

  await runCase("ST-U1-12", "เบอร์โทรผิดรูปแบบ", async (t) => {
    await openForm(t.page);
    await fillForm(t.page, { phone: "0812" });
    await expectBlocked(t, "เบอร์โทรศัพท์ไม่ถูกต้อง", dbMax());
  });
}

async function u3ChangeCase() {
  await runCase("ST-U3-03", "สถานะใน DB เปลี่ยน หน้าเว็บเปลี่ยนตาม", async ({ page, check, actual, note }) => {
    const id = state.u1First;
    if (!id) throw new Error("ไม่มีคำร้องที่รอรับเรื่องจาก ST-U1-01");
    await login(page, "resident01");
    await openHistory(page);
    const before = (await historyItems(page)).find((i) => idOf(i.meta) === id);
    const n = dbSetInProgress(id);
    check(`รัน UPDATE repair_requests SET status = 'IN_PROGRESS' กับ #${id} ได้ 1 แถว`, n === 1, `${n} แถว`);
    await openHistory(page);
    const after = (await historyItems(page)).find((i) => idOf(i.meta) === id);
    check("รีเฟรชแล้วป้ายเปลี่ยนเป็น กำลังดำเนินการ", after?.status === "กำลังดำเนินการ", after?.status);
    check("บรรทัดย่อยไม่ขึ้นคำว่า null/undefined", after && !/null|undefined/.test(after.meta), after?.meta);
    note(`ใช้คำร้อง #${id} ที่สร้างใน ST-U1-01 แทนคำร้องตั้งต้น เพื่อไม่ให้ข้อมูลตั้งต้นเปลี่ยน`);
    actual(`ก่อน: "${before?.status}" → UPDATE ${n} แถว → หลังรีเฟรช: "${after?.status}" (${after?.meta})`);
  });
}

// ================================================================ E2E
async function e2e() {
  await runCase("ST-E2E-01", "resident02 ส่งคำร้องแล้วติดตามได้ครบวงจร", async ({ page, check, rec }) => {
    const step = (n, ok, text) => { rec.steps.push({ n, ok: !!ok, text }); };
    const db0 = dbList(2);
    // 1
    await login(page, "resident02");
    const counts = [await text(page, "#count-pending"), await text(page, "#count-in-progress"), await text(page, "#count-completed")].map(Number);
    const want0 = ["PENDING", "IN_PROGRESS", "COMPLETED"].map((s) => db0.filter((r) => r.status === s).length);
    const ok1 = check("ขั้น 1: หน้าโฮมสรุปจำนวนคำร้องตรงกับ DB", JSON.stringify(counts) === JSON.stringify(want0), `เว็บ ${counts.join("/")} DB ${want0.join("/")}`);
    step(1, ok1, `หน้าโฮม รอรับเรื่อง/กำลังดำเนินการ/เสร็จสิ้น = ${counts.join("/")} · DB ${db0.length} รายการ (${want0.join("/")}) · ห้อง ${await text(page, "#user-room")}`);
    // 2
    await page.click("#new-request-link");
    await page.waitForURL(/repair-form\.html/);
    const form = await fillForm(page, { building: "อาคาร B", location: "ชั้น 2 ห้อง 210", category: "PLUMBING", equipment: "ก๊อกน้ำห้องน้ำรั่ว", description: "น้ำหยดจากก๊อกตลอดเวลา (ทดสอบ E2E)", phone: "082-345-6789", images: ["small1.jpg", "small2.jpg"] });
    const id = await submitOk(page);
    const ok2 = check("ขั้น 2: ส่งสำเร็จ ได้เลขคำร้อง", id > 0 && (await text(page, "#request-id")) === "#" + id);
    step(2, ok2, `หน้าส่งสำเร็จ เลขคำร้อง #${id}`);
    // 3
    await page.click("#check-request-link");
    await page.waitForURL(/request-check\.html/);
    await page.waitForLoadState("networkidle");
    const c = { equip: await text(page, "#equipment"), loc: await text(page, "#location"), cat: await text(page, "#category"), desc: await text(page, "#description") };
    const imgs = await page.locator("#image-list img").count();
    await page.click("#detail-link");
    await page.waitForURL(/request-detail\.html/);
    await page.waitForLoadState("networkidle");
    const tl = await page.locator("#timeline > li").count();
    const ok3 = check("ขั้น 3: ข้อมูลตรงกับที่กรอก มีรูป 2 รูป ประวัติสถานะ 1 รายการ",
      c.equip === form.equipment && c.loc === `${form.building} ${form.location}` && c.cat === CATEGORY_TH[form.category] && c.desc === form.description && imgs === 2 && tl === 1,
      `${JSON.stringify(c)} รูป ${imgs} ประวัติ ${tl}`);
    step(3, ok3, `"${c.equip}" · ${c.loc} · ${c.cat} · รูป ${imgs} · ประวัติสถานะ ${tl} รายการ`);
    // 4
    await page.click(".detail-home-btn");
    await page.waitForURL(/home\.html/);
    await page.waitForLoadState("networkidle");
    const counts2 = [await text(page, "#count-pending"), await text(page, "#count-in-progress"), await text(page, "#count-completed")].map(Number);
    const latest = await text(page, "#latest-request");
    const ok4 = check("ขั้น 4: จำนวน รอรับเรื่อง เพิ่ม 1 และคำร้องล่าสุดเป็นอันที่เพิ่งส่ง", counts2[0] === counts[0] + 1 && (latest || "").includes("#" + id), `รอรับเรื่อง ${counts[0]} → ${counts2[0]} · ล่าสุด ${(latest || "").match(/#\d+/)?.[0]}`);
    step(4, ok4, `รอรับเรื่อง ${counts[0]} → ${counts2[0]} · คำร้องล่าสุด ${(latest || "").match(/#\d+/)?.[0] || "-"}`);
    // 5
    await Promise.all([page.waitForResponse((r) => isApi(r, "GET", "/api/repair-requests/my")), page.click("#history-link")]);
    await page.waitForFunction(() => !/กำลังโหลด/.test(document.getElementById("result-count")?.textContent || ""));
    const items = await historyItems(page);
    const ok5 = check(`ขั้น 5: คำร้องใหม่อยู่บนสุด สถานะรอรับเรื่อง รวม ${db0.length + 1} รายการ`, idOf(items[0]?.meta || "") === id && items[0]?.status === "รอรับเรื่อง" && items.length === db0.length + 1, `${items.length} รายการ บนสุด ${items[0]?.meta} ${items[0]?.status}`);
    step(5, ok5, `บนสุด #${idOf(items[0]?.meta || "")} "${items[0]?.status}" · รวม ${items.length} รายการ`);
    // 6
    const r = dbRow(id);
    const ok6 = check("ขั้น 6: DB repair_requests 1 แถวใหม่ของ resident02 · request_images 2 แถว · request_status_history 1 แถว", r && r.residentId === 2 && r.images === 2 && r.history === 1, rowSummary(r));
    step(6, ok6, `DB: ${rowSummary(r)}`);
    // 7
    await page.goto(UI + "/pages/home.html");
    await page.waitForLoadState("networkidle");
    await page.click("#logout-btn");
    await page.waitForURL(/login\.html/, { timeout: 10000 }).catch(() => {});
    const ok7 = check("ขั้น 7: ออกจากระบบแล้วกลับหน้า Login", page.url().includes("login.html"), page.url());
    step(7, ok7, `กลับ ${new URL(page.url()).pathname}`);
  });
}

// ================================================================ main
async function main() {
  await fs.mkdir(OUT, { recursive: true });
  console.log(`D22 System Test · หน้าเว็บ ${UI} · backend ${API}`);
  const ui = await fetch(UI + "/pages/login.html").then((r) => r.status).catch(() => 0);
  if (ui !== 200) throw new Error(`เปิด ${UI} ไม่ได้ (รัน docker compose up -d ก่อน)`);
  if (!(await waitBackend(90000))) throw new Error(`backend ที่ ${API} ยังไม่พร้อม (ดู log ด้วย docker compose logs backend)`);
  let start;
  try { start = { r1: dbList(1).length, r2: dbList(2).length, r3: dbList(3).length, ...dbMax() }; }
  catch (e) { throw new Error("อ่านฐานข้อมูลไม่ได้: " + e.message); }
  const fresh = start.r1 === 3 && start.r2 === 1 && start.r3 === 0;
  console.log(`ฐานข้อมูล: resident01 ${start.r1} · resident02 ${start.r2} · resident03 ${start.r3} คำร้อง ${fresh ? "(สภาพตั้งต้น)" : "(ไม่ใช่สภาพตั้งต้น — แนะนำ docker compose down -v แล้ว up -d ก่อนรัน)"}`);

  await launch();
  console.log(`เบราว์เซอร์: ${browserName}\n`);
  await makeFixtures();

  await u2Cases();
  await u3ReadCases();
  await u1Cases();
  await u3ChangeCase();
  await e2e();
  await browser.close();

  const order = (id) => {
    const [, g, n] = id.match(/ST-(U1|U2|U3|E2E)-(\d+)/);
    return ["U1", "U2", "U3", "E2E"].indexOf(g) * 100 + Number(n);
  };
  results.sort((a, b) => order(a.id) - order(b.id));
  const label = { pass: "ผ่าน", fail: "ไม่ผ่าน" };
  const stamp = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const group = (g) => results.filter((r) => r.id.startsWith(`ST-${g}-`));
  const passN = results.filter((r) => r.status === "pass").length;

  let md = `# ผล D22 · System Test (Sprint 1)\n\n`;
  md += `รันเมื่อ ${stamp} · หน้าเว็บ ${UI} · backend ${API} · เบราว์เซอร์ ${browserName}\n`;
  md += `ฐานข้อมูลก่อนรัน: resident01 ${start.r1} · resident02 ${start.r2} · resident03 ${start.r3} คำร้อง ${fresh ? "(สภาพตั้งต้น)" : "(ไม่ใช่สภาพตั้งต้น)"}\n\n`;
  md += `**ผ่าน ${passN} · ไม่ผ่าน ${results.length - passN} จาก ${results.length} เคส**\n\n`;
  md += `| Story | เคส | ผ่าน | ไม่ผ่าน |\n|---|---|---|---|\n`;
  for (const g of ["U1", "U2", "U3", "E2E"]) {
    const rs = group(g);
    md += `| ${g} | ${rs.length} | ${rs.filter((r) => r.status === "pass").length} | ${rs.filter((r) => r.status !== "pass").length} |\n`;
  }
  md += `\n| ID | ผล | ผลจริง | หลักฐาน |\n|---|---|---|---|\n`;
  for (const r of results) md += `| ${r.id} | ${label[r.status]} | ${(r.actual.join(" · ") || r.error || "").replace(/\|/g, "/")} | ${r.id}.png |\n`;
  md += `\n## รายละเอียดรายเคส\n`;
  for (const r of results) {
    md += `\n### ${r.id} ${r.title} — ${label[r.status]}\n\n`;
    for (const c of r.checks) md += `- ${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}\n`;
    if (r.error) md += `- ✗ error: ${r.error}\n`;
    for (const st of r.steps) md += `- ขั้น ${st.n} (${st.ok ? "ผ่าน" : "ไม่ผ่าน"}): ${st.text}\n`;
    for (const n of r.notes) md += `- หมายเหตุ: ${n}\n`;
  }
  await fs.writeFile(path.join(OUT, "d22-results.md"), md);
  await fs.writeFile(path.join(OUT, "d22-results.json"), JSON.stringify({ ranAt: stamp, ui: UI, api: API, browser: browserName, dbBefore: start, results }, null, 2));
  console.log(`\nผ่าน ${passN} · ไม่ผ่าน ${results.length - passN} จาก ${results.length} เคส`);
  console.log(`ผลอยู่ที่ ${path.join(path.relative(process.cwd(), OUT), "d22-results.md")}`);
  process.exitCode = passN === results.length ? 0 : 1;
}

main().catch(async (e) => {
  console.error("\nหยุดทำงาน: " + e.message);
  try { await browser?.close(); } catch { /* ignore */ }
  process.exit(2);
});
