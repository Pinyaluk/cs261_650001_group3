// js/home.js
// หน้าหลัก: นับสถานะคำร้อง + แสดงคำร้องล่าสุด 1 รายการ

requireLogin();

const countPending = document.getElementById("count-pending");
const countInProgress = document.getElementById("count-in-progress");
const countCompleted = document.getElementById("count-completed");
const latestRequest = document.getElementById("latest-request");
const latestDetailLink = document.getElementById("latest-detail-link");
const itemTemplate = document.getElementById("request-item-template");

// เลขห้องของผู้ที่ login (เก็บไว้ตอน login) แทนข้อความตัวอย่างใน HTML
const userRoom = document.getElementById("user-room");
if (userRoom) userRoom.textContent = localStorage.getItem("roomNumber") || "-";

function countByStatus(list, status) {
  return list.filter((r) => r.status === status).length;
}

function renderLatest(r) {
  const clone = itemTemplate.content.cloneNode(true);
  clone.querySelector('[data-field="link"]').href = "request-check.html?id=" + r.requestId;
  clone.querySelector('[data-field="title"]').textContent = r.title;
  clone.querySelector('[data-field="meta"]').textContent = requestMetaText(r);
  renderStatusBadge(clone.querySelector('[data-field="status"]'), r.status);
  latestRequest.innerHTML = "";
  latestRequest.appendChild(clone);
  if (latestDetailLink) latestDetailLink.href = "request-check.html?id=" + r.requestId;
}

async function init() {
  try {
    const list = await getMyRequests(); // เรียงใหม่ไปเก่า ตัวแรกคือล่าสุด

    countPending.textContent = countByStatus(list, "PENDING");
    countInProgress.textContent = countByStatus(list, "IN_PROGRESS");
    countCompleted.textContent = countByStatus(list, "COMPLETED");

    if (list.length > 0) {
      renderLatest(list[0]);
    } else {
      latestRequest.textContent = "ยังไม่มีคำร้อง";
      if (latestDetailLink) latestDetailLink.classList.add("is-hidden");
    }
  } catch (err) {
    latestRequest.textContent = err.message;
  }
}
init();