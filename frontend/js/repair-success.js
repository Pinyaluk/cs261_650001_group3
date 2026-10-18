// js/repair-success.js
// หน้าส่งคำร้องสำเร็จ: อ่านเลขคำร้องจาก URL (?id=1024) แล้วแสดงผล

requireLogin();

const requestIdEl = document.getElementById("request-id");
const requestStatusEl = document.getElementById("request-status");
const preferredTimeEl = document.getElementById("preferred-time-text");
const checkRequestLink = document.getElementById("check-request-link");

const id = getQueryParam("id");

// ดึงสถานะและช่วงเวลาที่สะดวกมาแสดง (ข้อมูลเสริม ถ้าดึงไม่ได้หน้ายังใช้งานได้)
// วันนัดจริงเจ้าหน้าที่เป็นคนยืนยันใน Sprint 2 หน้านี้จึงแสดงช่วงเวลาที่ผู้พักอาศัยเลือกไว้
async function loadDetails() {
  try {
    const request = await getRequestById(id);
    if (!request) return;
    renderStatusBadge(requestStatusEl, request.status);
    const times = [[request.preferredDate1, request.preferredSlot1], [request.preferredDate2, request.preferredSlot2]]
      .filter(([date]) => date)
      .map(([date, slot]) => `${formatDate(date)} · ${timeSlotText(slot)}`);
    if (times.length) preferredTimeEl.textContent = times.join(" / ");
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