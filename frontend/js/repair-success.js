// js/repair-success.js
// หน้าส่งคำร้องสำเร็จ: อ่านเลขคำร้องจาก URL (?id=1024) แล้วแสดงผล

requireLogin();

const requestIdEl = document.getElementById("request-id");
const requestStatusEl = document.getElementById("request-status");
const appointmentTextEl = document.getElementById("appointment-text");
const checkRequestLink = document.getElementById("check-request-link");

const id = getQueryParam("id");

// ดึงสถานะและวันนัดมาแสดง (ข้อมูลเสริม ถ้าดึงไม่ได้หน้ายังใช้งานได้)
async function loadDetails() {
  try {
    const request = await getRequestById(id);
    if (!request) return;
    renderStatusBadge(requestStatusEl, request.status);
    if (request.appointmentDateTime) {
      appointmentTextEl.textContent = formatDateTime(request.appointmentDateTime);
    }
    // ถ้ายังไม่มีวันนัด ปล่อยข้อความเดิมใน HTML ("รอยืนยันวันและเวลา")
  } catch (err) {
    // ไม่แสดง error เพราะเป็นข้อมูลเสริม
  }
}

if (!id) {
  // เปิดหน้านี้ตรงๆ โดยไม่มีเลขคำร้อง ให้กลับหน้าหลัก
  window.location.replace("home.html");
} else {
  requestIdEl.textContent = "#" + id;
  checkRequestLink.href = "request-check.html?id=" + encodeURIComponent(id);
  loadDetails();
}