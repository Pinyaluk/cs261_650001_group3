// js/repair-form.js
// หน้าแจ้งซ่อม: ตรวจฟอร์ม + เช็ครูป + เตือนวันเวลาในอดีต + ตัวอย่างรูป + ส่ง FormData

requireLogin();

// ---------- ค่าคงที่ ----------
const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

// ช่องที่ต้องกรอก: [id, ข้อความเตือน]
const REQUIRED_FIELDS = [
  ["building", "กรุณาเลือกอาคาร"],
  ["location", "กรุณากรอกห้อง / จุดที่พบปัญหา"],
  ["category", "กรุณาเลือกหมวดปัญหา"],
  ["equipment", "กรุณากรอกอุปกรณ์ที่ชำรุด"],
  ["description", "กรุณากรอกรายละเอียดปัญหา"],
  ["preferred-date-1", "กรุณาเลือกวันที่สะดวก"],
  ["preferred-time-1", "กรุณาเลือกช่วงเวลา"],
  ["phone", "กรุณากรอกเบอร์โทรศัพท์ที่ติดต่อได้"]
];

// ---------- หา element (ใช้ id ตามกติกาทีม) ----------
const repairForm = document.getElementById("repair-form");
const imagesInput = document.getElementById("images");
const imagePreview = document.getElementById("image-preview");
const imageCount = document.getElementById("image-count");
const imagesError = document.getElementById("images-error");
const submitBtn = document.getElementById("submit-btn");

repairForm.noValidate = true; // ปิดการตรวจของเบราว์เซอร์ ใช้ข้อความเตือนของเราแทน

// ---------- โชว์ / ล้าง error ของแต่ละช่อง ----------
function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(fieldId + "-error");
  if (errorEl) errorEl.textContent = message;
  const group = field ? field.closest(".form-group") : null;
  if (group) group.classList.add("is-invalid");
}

function clearError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(fieldId + "-error");
  if (errorEl) errorEl.textContent = "";
  const group = field ? field.closest(".form-group") : null;
  if (group) group.classList.remove("is-invalid");
}

// ---------- 1) ตรวจว่ากรอกครบไหม ----------
function validateRequired() {
  let firstInvalid = null;
  for (const [id, message] of REQUIRED_FIELDS) {
    const field = document.getElementById(id);
    if (!field) continue;
    if (field.value.trim() === "") {
      showError(id, message);
      if (!firstInvalid) firstInvalid = field;
    } else {
      clearError(id);
    }
  }
  return firstInvalid; // null = ผ่านหมด
}

// ---------- 2) เช็ครูป: ไม่เกิน 3 รูป, รูปละไม่เกิน 5MB ----------
function validateImages(files, requireOne = false) {
  if (requireOne && files.length === 0) return "กรุณาแนบรูปอย่างน้อย 1 รูป";
  if (files.length > MAX_FILES) return "แนบรูปได้ไม่เกิน 3 รูป";
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) return "รองรับเฉพาะไฟล์ JPG และ PNG";
    if (file.size > MAX_SIZE) return "รูปแต่ละรูปต้องมีขนาดไม่เกิน 5MB";
  }
  return "";
}

// ---------- 3) เตือนเมื่อเลือกวันเวลาในอดีต ----------
// ช่วงเวลามี 2 แบบ (MORNING / AFTERNOON) ตัดสินว่า "ผ่านไปแล้ว" แบบนี้ (สมมติเอง ปรับได้)
//   วันก่อนวันนี้ = อดีต, วันนี้ + เช้า = อดีตถ้าเลย 12:00, วันนี้ + บ่าย = อดีตถ้าเลย 17:00
function isPast(dateValue, slot) {
  if (!dateValue) return false;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // รูปแบบ 2026-10-20
  if (dateValue < todayStr) return true;
  if (dateValue > todayStr) return false;
  if (slot === "MORNING") return now.getHours() >= 12;
  if (slot === "AFTERNOON") return now.getHours() >= 17;
  return false;
}

function checkPastDate(n) {
  const dateEl = document.getElementById(`preferred-date-${n}`);
  const timeEl = document.getElementById(`preferred-time-${n}`);
  if (!dateEl || !dateEl.value) return true;
  if (isPast(dateEl.value, timeEl ? timeEl.value : "")) {
    showError(`preferred-date-${n}`, "ไม่สามารถเลือกวันเวลาที่ผ่านมาแล้วได้");
    return false;
  }
  clearError(`preferred-date-${n}`);
  return true;
}

// วันที่สะดวกเพิ่มเติม: ต้องกรอกทั้งคู่หรือว่างทั้งคู่
function checkSecondSlotPair() {
  const date2 = document.getElementById("preferred-date-2");
  const time2 = document.getElementById("preferred-time-2");
  if (!date2 || !time2) return true;
  if ((date2.value === "") !== (time2.value === "")) {
    showError("preferred-date-2", "กรุณากรอกวันที่และช่วงเวลาให้ครบทั้งคู่ หรือเว้นว่างทั้งคู่");
    return false;
  }
  return true;
}

// ---------- 4) แสดงตัวอย่างรูปก่อนส่ง ----------
imagesInput.addEventListener("change", () => {
  const files = Array.from(imagesInput.files);
  imagePreview.innerHTML = "";
  imageCount.textContent = `แนบรูปแล้ว 0 จาก ${MAX_FILES} รูป`;

  const message = validateImages(files);
  if (message) {
    imagesError.textContent = message;
    imagesInput.value = ""; // ล้างไฟล์ที่ไม่ผ่านทิ้ง
    return;
  }
  imagesError.textContent = "";

  const template = document.getElementById("image-thumb-template");
  for (const file of files) {
    const clone = template.content.cloneNode(true);
    clone.querySelector('[data-field="img"]').src = URL.createObjectURL(file);
    clone.querySelector('[data-field="caption"]').textContent = file.name;
    imagePreview.appendChild(clone);
  }
  imageCount.textContent = `แนบรูปแล้ว ${files.length} จาก ${MAX_FILES} รูป`;
});

// ---------- เตรียมหน้า ----------
const today = new Date().toISOString().split("T")[0];
for (const n of [1, 2]) {
  const dateEl = document.getElementById(`preferred-date-${n}`);
  const timeEl = document.getElementById(`preferred-time-${n}`);
  if (dateEl) {
    dateEl.min = today; // ปฏิทินเลือกวันที่ผ่านมาไม่ได้
    dateEl.addEventListener("change", () => checkPastDate(n));
  }
  if (timeEl) timeEl.addEventListener("change", () => checkPastDate(n));
}

// ชื่อผู้พักอาศัย (เก็บไว้ตอน login)
const residentInfo = document.getElementById("resident-info");
if (residentInfo && localStorage.getItem("fullName")) {
  residentInfo.textContent = localStorage.getItem("fullName");
}

// ---------- ตอนกดส่ง ----------
repairForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const firstInvalid = validateRequired();
  const date1Ok = checkPastDate(1);
  const date2Ok = checkPastDate(2) && checkSecondSlotPair();
  const imageMsg = validateImages(Array.from(imagesInput.files), true);
  imagesError.textContent = imageMsg;

  if (firstInvalid || !date1Ok || !date2Ok || imageMsg) {
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  // ประกอบ FormData ตามชื่อช่องที่ backend กำหนด
  const formData = new FormData();
  const areaCommon = document.getElementById("area-common");
  formData.append("locationType", areaCommon && areaCommon.checked ? "COMMON_AREA" : "ROOM");
  formData.append("building", document.getElementById("building").value);
  formData.append("locationDetail", document.getElementById("location").value.trim());
  formData.append("category", document.getElementById("category").value);
  formData.append("title", document.getElementById("equipment").value.trim());
  formData.append("description", document.getElementById("description").value.trim());
  formData.append("preferredDate1", document.getElementById("preferred-date-1").value);
  formData.append("preferredSlot1", document.getElementById("preferred-time-1").value);

  const date2 = document.getElementById("preferred-date-2").value;
  const slot2 = document.getElementById("preferred-time-2").value;
  if (date2 && slot2) { // ส่งเฉพาะตอนกรอกครบทั้งคู่
    formData.append("preferredDate2", date2);
    formData.append("preferredSlot2", slot2);
  }

  formData.append("contactPhone", document.getElementById("phone").value.trim());
  formData.append("lineId", document.getElementById("line-id").value.trim());

  const urgent = document.getElementById("urgent"); // nathan จะเพิ่ม checkbox นี้
  formData.append("urgency", urgent && urgent.checked ? "URGENT" : "NORMAL");

  for (const file of imagesInput.files) {
    formData.append("images", file); // ชื่อ "images" ทีละรูป
  }

  submitBtn.disabled = true; // กันกดซ้ำ
  try {
    const created = await submitRequest(formData); // ห้ามตั้ง Content-Type เอง
    window.location.href = "repair-success.html?id=" + created.requestId;
  } catch (err) {
    // 400 = ข้อมูลไม่ถูกต้อง backend ส่งข้อความไทยมาให้
    const formError = document.getElementById("form-error");
    if (formError) {
      formError.textContent = err.message;
    } else {
      alert(err.message);
    }
    submitBtn.disabled = false;
  }
});