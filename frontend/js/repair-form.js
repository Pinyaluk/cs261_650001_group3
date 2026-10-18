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
const formError = document.getElementById("form-error");

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

// ข้อความเตือนเรื่องรูป: ต้องใส่ is-invalid ให้กลุ่มด้วย ไม่งั้น .error-msg ถูกซ่อน มองไม่เห็น
function setImagesError(message) {
  imagesError.textContent = message;
  const group = imagesError.closest(".form-group");
  if (group) group.classList.toggle("is-invalid", message !== "");
}

// ข้อความรวมเหนือปุ่มส่ง (กรอกไม่ครบ หรือ error จาก backend)
function setFormError(message) {
  if (!formError) {
    if (message) alert(message);
    return;
  }
  formError.textContent = message;
  formError.classList.toggle("is-visible", message !== "");
}

// วันที่ตามเวลาเครื่อง (ไม่ใช้ toISOString เพราะเป็นเวลา UTC ช่วงตี 0–7 จะได้วันของเมื่อวาน)
function localDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  if (requireOne && files.length === 0) return "กรุณาแนบรูปภาพอย่างน้อย 1 รูป";
  if (files.length > MAX_FILES) return "แนบรูปได้ไม่เกิน 3 รูป";
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_SIZE) return "รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB";
  }
  return "";
}

// ---------- 3) เตือนเมื่อเลือกวันเวลาในอดีต ----------
// ช่วงเวลามี 2 แบบ (MORNING / AFTERNOON) ตัดสินว่า "ผ่านไปแล้ว" แบบนี้ (สมมติเอง ปรับได้)
//   วันก่อนวันนี้ = อดีต, วันนี้ + เช้า = อดีตถ้าเลย 12:00, วันนี้ + บ่าย = อดีตถ้าเลย 17:00
function isPast(dateValue, slot) {
  if (!dateValue) return false;
  const now = new Date();
  const todayStr = localDateString(now); // รูปแบบ 2026-10-20
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
    showError(`preferred-date-${n}`, "กรุณาเลือกวันเวลาในอนาคต");
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
    showError("preferred-date-2", "กรุณากรอกวันและช่วงเวลาเพิ่มเติมให้ครบ หรือเว้นว่างทั้งคู่");
    return false;
  }
  if (date2.value === "") clearError("preferred-date-2");
  return true;
}

// ช่วงที่ 2 ต้องไม่ใช่วันและช่วงเวลาเดียวกับช่วงแรก
function checkNotDuplicateSlot() {
  const date1 = document.getElementById("preferred-date-1").value;
  const time1 = document.getElementById("preferred-time-1").value;
  const date2 = document.getElementById("preferred-date-2").value;
  const time2 = document.getElementById("preferred-time-2").value;
  if (date2 && time2 && date2 === date1 && time2 === time1) {
    showError("preferred-date-2", "ช่วงเวลาเพิ่มเติมต้องไม่ซ้ำกับช่วงแรก");
    return false;
  }
  return true;
}

// เบอร์โทร: ขึ้นต้นด้วย 0 ยาว 9–10 หลัก (เว้นวรรคหรือขีดได้) เช่น 081-234-5678, 02-555-0180
function checkPhone() {
  const phone = document.getElementById("phone");
  if (!phone || phone.value.trim() === "") return true; // ช่องว่างให้ validateRequired เตือนแทน
  const digits = phone.value.replace(/[\s-]/g, "");
  if (!/^0\d{8,9}$/.test(digits)) {
    showError("phone", "เบอร์โทรศัพท์ไม่ถูกต้อง");
    return false;
  }
  return true;
}

// เหตุผลที่รูปชุดล่าสุดถูกปฏิเสธ (ใหญ่เกิน / ไม่ใช่รูป / เกิน 3 รูป)
// เก็บไว้แสดงต่อตอนกดส่ง จนกว่าจะเลือกรูปที่ใช้ได้ ผู้ใช้จะได้รู้ว่าทำไมส่งไม่ได้
let rejectedImagesMessage = "";

// ---------- 4) แสดงตัวอย่างรูปก่อนส่ง ----------
imagesInput.addEventListener("change", () => {
  const files = Array.from(imagesInput.files);
  imagePreview.innerHTML = "";
  imageCount.textContent = `แนบรูปแล้ว 0 จาก ${MAX_FILES} รูป`;

  const message = validateImages(files);
  if (message) {
    rejectedImagesMessage = message;
    setImagesError(message);
    imagesInput.value = ""; // ล้างไฟล์ที่ไม่ผ่านทิ้ง
    return;
  }
  rejectedImagesMessage = "";
  setImagesError("");

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
const today = localDateString();
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
  const date2Ok = checkPastDate(2) && checkSecondSlotPair() && checkNotDuplicateSlot();
  const phoneOk = checkPhone();
  const files = Array.from(imagesInput.files);
  const imageMsg = files.length === 0 && rejectedImagesMessage ? rejectedImagesMessage : validateImages(files, true);
  setImagesError(imageMsg);
  setFormError(firstInvalid ? "กรุณากรอกข้อมูลให้ครบ" : "");

  if (firstInvalid || !date1Ok || !date2Ok || !phoneOk || imageMsg) {
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
    // 400 = ข้อมูลไม่ถูกต้อง backend ส่งข้อความไทยมาให้ · 0 = เชื่อมต่อเซิร์ฟเวอร์ไม่ได้
    setFormError(err.message);
    submitBtn.disabled = false;
  }
});