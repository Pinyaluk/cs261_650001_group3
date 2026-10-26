// js/history.js
// หน้าประวัติคำร้อง: ดึงรายการ → แสดง (มือถือ = การ์ด, จอคอม = ตาราง) → ค้นหา + กรอง

requireLogin();

const requestList = document.getElementById("request-list");
const itemTemplate = document.getElementById("request-item-template");
const tableBody = document.getElementById("request-table-body");
const rowTemplate = document.getElementById("request-row-template");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const tableCount = document.getElementById("table-count");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const statusSelect = document.getElementById("status-select");
const urgencySelect = document.getElementById("urgency-select");
const monthSelect = document.getElementById("month-select");

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

let allRequests = [];      // รายการทั้งหมดจาก API
let currentStatus = "ALL"; // ตัวกรองสถานะ (ใช้ร่วมกันทั้งปุ่มมือถือและ dropdown จอคอม)

function monthKey(dateString) {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function setText(elId, text) {
  const el = document.getElementById(elId);
  if (el) el.textContent = text;
}

/** สถานที่ เช่น "ห้องพัก • อาคาร A ชั้น 3 · ห้อง 305" (ต้องใช้ API /my ที่มี locationType, building, locationDetail) */
function placeText(r) {
  const place = `${r.building || ""} ${r.locationDetail || ""}`.trim();
  const type = r.locationType ? locationTypeText(r.locationType) : "";
  return [`#${r.requestId}`, type, place].filter(Boolean).join(" • ");
}

function getFiltered() {
  const keyword = searchInput.value.trim().toLowerCase();
  const urgency = urgencySelect ? urgencySelect.value : "ALL";
  const month = monthSelect ? monthSelect.value : "ALL";
  return allRequests.filter((r) => {
    const matchStatus = currentStatus === "ALL" || r.status === currentStatus;
    const matchUrgency = urgency === "ALL" || r.urgency === urgency;
    const matchMonth = month === "ALL" || monthKey(r.createdAt) === month;
    const text = `${r.requestId} ${r.title} ${categoryText(r.category)}`.toLowerCase();
    return matchStatus && matchUrgency && matchMonth && text.includes(keyword);
  });
}

function renderCards(list) {
  requestList.innerHTML = "";
  for (const r of list) {
    const clone = itemTemplate.content.cloneNode(true);
    clone.querySelector('[data-field="link"]').href = "request-check.html?id=" + r.requestId;
    clone.querySelector('[data-field="title"]').textContent = r.title;
    clone.querySelector('[data-field="meta"]').textContent = requestMetaText(r);
    renderStatusBadge(clone.querySelector('[data-field="status"]'), r.status);
    requestList.appendChild(clone);
  }
}

function renderTable(list) {
  if (!tableBody || !rowTemplate) return;
  tableBody.innerHTML = "";
  for (const r of list) {
    const clone = rowTemplate.content.cloneNode(true);
    const row = clone.firstElementChild;
    const href = "request-check.html?id=" + r.requestId;
    const link = clone.querySelector('[data-field="link"]');
    link.href = href;
    link.textContent = r.title;
    clone.querySelector('[data-field="place"]').textContent = placeText(r);
    renderStatusBadge(clone.querySelector('[data-field="status"]'), r.status);

    const urgencyEl = clone.querySelector('[data-field="urgency"]');
    if (r.urgency) {
      urgencyEl.textContent = r.urgency === "URGENT" ? "เร่งด่วน" : "ปกติ";
      urgencyEl.classList.add(r.urgency === "URGENT" ? "badge--urgent" : "badge--normal");
    } else {
      urgencyEl.replaceWith("-");
    }

    clone.querySelector('[data-field="date"]').textContent = formatDateTime(r.createdAt) + " น.";
    clone.querySelector('[data-field="technician"]').textContent = r.technicianName || "ยังไม่มอบหมาย";
    row.addEventListener("click", (e) => {
      if (!e.target.closest("a")) window.location.href = href; // คลิกตรงไหนของแถวก็เปิดคำร้อง
    });
    tableBody.appendChild(clone);
  }
}

function renderList() {
  const filtered = getFiltered();
  renderCards(filtered);
  renderTable(filtered);

  resultCount.textContent = `ทั้งหมด ${filtered.length} รายการ · เรียงตามวันที่แจ้งล่าสุด`;
  if (tableCount) tableCount.textContent = `แสดง ${filtered.length} คำร้องของฉัน`;
  // ยังไม่เคยแจ้งเลย กับ ค้นหา/กรองแล้วไม่เจอ ใช้ข้อความต่างกัน
  emptyState.textContent = allRequests.length === 0 ? "ยังไม่มีคำร้อง" : "ไม่พบคำร้องที่ตรงกับการค้นหา";
  emptyState.classList.toggle("is-hidden", filtered.length > 0);
}

/** การ์ดสรุป 3 สถานะ + หัวการ์ด (จอคอม) */
function renderSummary() {
  const count = (status) => allRequests.filter((r) => r.status === status).length;
  setText("stat-pending", count("PENDING"));
  setText("stat-in-progress", count("IN_PROGRESS"));
  setText("stat-completed", count("COMPLETED"));
  setText("history-subtitle", `${allRequests.length} คำร้อง • ไม่แสดงข้อมูลคำร้องของผู้พักอาศัยคนอื่น`);
}

/** ตัวเลือกเดือน สร้างจากเดือนที่มีคำร้องจริง เช่น "เดือนตุลาคม 2569" */
function renderMonthOptions() {
  if (!monthSelect) return;
  const seen = new Map();
  for (const r of allRequests) {
    const d = new Date(r.createdAt);
    seen.set(monthKey(r.createdAt), `เดือน${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`);
  }
  for (const [key, label] of seen) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = label;
    monthSelect.appendChild(opt);
  }
}

function setStatus(status) {
  currentStatus = status;
  for (const btn of statusFilter.querySelectorAll("button[data-status]")) {
    btn.classList.toggle("is-active", btn.dataset.status === status);
  }
  if (statusSelect) statusSelect.value = status;
  renderList();
}

// ค้นหา: กรองทันทีที่พิมพ์
searchInput.addEventListener("input", renderList);

// มือถือ: กดปุ่มกรองสถานะ
statusFilter.addEventListener("click", (e) => {
  const chip = e.target.closest("button[data-status]");
  if (chip) setStatus(chip.dataset.status);
});

// จอคอม: dropdown
if (statusSelect) statusSelect.addEventListener("change", () => setStatus(statusSelect.value));
if (urgencySelect) urgencySelect.addEventListener("change", renderList);
if (monthSelect) monthSelect.addEventListener("change", renderList);

// โหลดข้อมูลตอนเปิดหน้า
async function init() {
  try {
    allRequests = await getMyRequests();
    renderSummary();
    renderMonthOptions();
    renderList();
  } catch (err) {
    resultCount.textContent = err.message;
    if (tableCount) tableCount.textContent = err.message;
  }
}
init();
