// js/history.js
// หน้าประวัติคำร้อง: ดึงรายการ → แสดง → ค้นหา + กรองสถานะ

requireLogin();

const requestList = document.getElementById("request-list");
const itemTemplate = document.getElementById("request-item-template");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const backBtn = document.getElementById("back-btn");

let allRequests = [];      // รายการทั้งหมดจาก API
let currentStatus = "ALL"; // ตัวกรองที่เลือกอยู่

function renderList() {
  const keyword = searchInput.value.trim().toLowerCase();

  // กรองตามสถานะ + คำค้นหา
  const filtered = allRequests.filter((r) => {
    const matchStatus = currentStatus === "ALL" || r.status === currentStatus;
    const text = `${r.requestId} ${r.title} ${categoryText(r.category)}`.toLowerCase();
    return matchStatus && text.includes(keyword);
  });

  // สร้างรายการใหม่จาก <template>
  requestList.innerHTML = "";
  for (const r of filtered) {
    const clone = itemTemplate.content.cloneNode(true);
    clone.querySelector('[data-field="link"]').href = "request-check.html?id=" + r.requestId;
    clone.querySelector('[data-field="title"]').textContent = r.title;
    clone.querySelector('[data-field="meta"]').textContent = requestMetaText(r);
    renderStatusBadge(clone.querySelector('[data-field="status"]'), r.status);
    requestList.appendChild(clone);
  }

  resultCount.textContent = `ทั้งหมด ${filtered.length} รายการ`;
  // ยังไม่เคยแจ้งเลย กับ ค้นหา/กรองแล้วไม่เจอ ใช้ข้อความต่างกัน
  emptyState.textContent = allRequests.length === 0 ? "ยังไม่มีคำร้อง" : "ไม่พบคำร้องที่ตรงกับการค้นหา";
  emptyState.classList.toggle("is-hidden", filtered.length > 0);
}

// ค้นหา: กรองทันทีที่พิมพ์
searchInput.addEventListener("input", renderList);

// กดปุ่มกรองสถานะ
statusFilter.addEventListener("click", (e) => {
  const chip = e.target.closest("button[data-status]");
  if (!chip) return;
  currentStatus = chip.dataset.status;
  for (const btn of statusFilter.querySelectorAll("button[data-status]")) {
    btn.classList.toggle("is-active", btn === chip);
  }
  renderList();
});

// ปุ่มย้อนกลับ
if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "home.html";
  });
}

// โหลดข้อมูลตอนเปิดหน้า
async function init() {
  try {
    allRequests = await getMyRequests();
    renderList();
  } catch (err) {
    resultCount.textContent = err.message;
  }
}
init();