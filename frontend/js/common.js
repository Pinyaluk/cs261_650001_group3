// js/common.js
// ฟังก์ชันที่ทุกหน้าใช้ร่วมกัน (ต้องโหลดหลัง api-client.js)

// 1) แปลงสถานะจาก API เป็นข้อความ + class ของ badge
const STATUS = {
  PENDING:     { text: "รอรับเรื่อง",    cls: "badge--pending" },
  IN_PROGRESS: { text: "กำลังดำเนินการ", cls: "badge--in-progress" },
  COMPLETED:   { text: "เสร็จสิ้น",      cls: "badge--completed" }
};

function renderStatusBadge(element, status) {
  const info = STATUS[status];
  if (!info) return;
  element.textContent = info.text;
  // ลบสีเดิมที่ติดมากับ HTML ตัวอย่างก่อน ไม่งั้นจะมี 2 สีซ้อนกัน
  Object.values(STATUS).forEach(s => element.classList.remove(s.cls));
  element.classList.add("badge", info.cls);
}

// 2) แปลงค่าอื่นๆ จาก API เป็นภาษาไทย
const CATEGORY = {
  ELECTRICAL: "ไฟฟ้า",
  PLUMBING: "ประปา",
  AIR_CONDITIONER: "เครื่องปรับอากาศ",
  FURNITURE: "เฟอร์นิเจอร์",
  OTHER: "อื่นๆ"
};

const TIME_SLOT = {
  MORNING: "ช่วงเช้า",
  AFTERNOON: "ช่วงบ่าย"
};

const LOCATION_TYPE = {
  ROOM: "ห้องพัก",
  COMMON_AREA: "พื้นที่ส่วนกลาง"
};

function categoryText(code) { return CATEGORY[code] || code; }
function timeSlotText(code) { return TIME_SLOT[code] || code; }
function locationTypeText(code) { return LOCATION_TYPE[code] || code; }

/** แสดงหรือซ่อนป้าย "เร่งด่วน" ตามค่า urgency จาก API */
function renderUrgencyBadge(element, urgency) {
  if (!element) return;
  element.classList.toggle("is-hidden", urgency !== "URGENT");
}

// 3) จัดรูปแบบวันที่เป็น พ.ศ. เช่น 12/10/2569
function formatDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

/** วันที่และเวลา เช่น 12/10/2569 · 10:00 */
function formatDateTime(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(dateString)} · ${hh}:${mm}`;
}

/**
 * บรรทัดย่อยใต้ชื่อคำร้องในรายการ
 * รอรับเรื่อง → วันที่แจ้ง · กำลังดำเนินการ → ชื่อช่าง · เสร็จสิ้น → วันที่เสร็จ (updatedAt)
 */
function requestMetaText(r) {
  const head = `#${r.requestId} · ${categoryText(r.category)}`;
  if (r.status === "IN_PROGRESS") return `${head} · ช่าง ${r.technicianName || "ยังไม่มอบหมาย"}`;
  if (r.status === "COMPLETED") return `${head} · เสร็จ ${formatDate(r.updatedAt)}`;
  return `${head} · แจ้งเมื่อ ${formatDate(r.createdAt)}`;
}

/** อ่านค่าจาก URL เช่น request-detail.html?id=1019 → getQueryParam("id") = "1019" */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// 4) ปุ่มออกจากระบบ (id = logout-btn) แจ้ง backend ก่อนแล้วกลับหน้า login
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

// 5) แสดงชื่อผู้ใช้ที่ login อยู่ (id = user-name) ถ้าหน้านั้นมี
const userNameEl = document.getElementById("user-name");
if (userNameEl && localStorage.getItem("fullName")) {
  userNameEl.textContent = localStorage.getItem("fullName");
}

// 6) ชื่อและห้องที่แถบหัว (มุมขวาบน จอคอม) ตาม Figma
const headerNameEl = document.getElementById("header-name");
const headerRoomEl = document.getElementById("header-room");
if (headerNameEl && localStorage.getItem("fullName")) {
  headerNameEl.textContent = localStorage.getItem("fullName");
}
if (headerRoomEl && localStorage.getItem("roomNumber")) {
  headerRoomEl.textContent = "ห้อง " + localStorage.getItem("roomNumber");
}
