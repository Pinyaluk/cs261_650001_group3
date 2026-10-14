// js/common.js
// ฟังก์ชันที่ทุกหน้าใช้ร่วมกัน

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
  element.classList.add("badge", info.cls);
}

// 2) จัดรูปแบบวันที่เป็น พ.ศ. เช่น 12/10/2569
function formatDate(dateString) {
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

// 3) ปุ่มออกจากระบบ (id = logout-btn)
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("user");
    window.location.href = "login.html";
  });
}