// js/repair-form.js
// หน้าแจ้งซ่อม: ตรวจฟอร์ม + เช็ครูป + เตือนวันเวลาในอดีต + แสดงตัวอย่างรูป

// ---------- ค่าคงที่ ----------
const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

// ช่องที่ "ต้องกรอก" : [id, ข้อความเตือน]
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

// ---------- ฟังก์ชันช่วย: โชว์ / ล้าง error ของแต่ละช่อง ----------
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
  return firstInvalid; // ถ้าไม่มีช่องผิด จะเป็น null
}

// ---------- 2) เช็ครูป: ไม่เกิน 3 รูป, รูปละไม่เกิน 5MB ----------
function validateImages(files) {
  if (files.length > MAX_FILES) return "แนบรูปได้ไม่เกิน 3 รูป";
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) return "รองรับเฉพาะไฟล์ JPG และ PNG";
    if (file.size > MAX_SIZE) return "รูปแต่ละรูปต้องมีขนาดไม่เกิน 5MB";
  }
  return ""; // ผ่าน
}

// ---------- 3) เตือนเมื่อเลือกวันเวลาในอดีต ----------
// ค่าของช่วงเวลา (select) ยังไม่รู้ว่าเพื่อน HTML ตั้งเป็นอะไร
// ฟังก์ชันนี้ดึงเวลาแรกที่เจอ เช่น "09:00-12:00" -> 09:00 ถ้าไม่เจอจะเทียบแค่วันที่
function isPast(dateValue, timeValue) {
  if (!dateValue) return false;
  const match = /(\d{1,2}):(\d{2})/.exec(timeValue || "");
  const time = match ? `${match[1].padStart(2, "0")}:${match[2]}` : "23:59";
  return new Date(`${dateValue}T${time}`) < new Date();
}

function checkPastDate(n) {
  const dateEl = document.getElementById(`preferred-date-${n}`);
  const timeEl = document.getElementById(`preferred-time-${n}`);
  if (!dateEl || !dateEl.value) return true;
  if (isPast(dateEl.value, timeEl ? timeEl.value : "")) {
    showError(`preferred-date-${n}`, "ไม่สามารถเลือกวันเวลาที่ผ่านมาแล้วได้");
    return false;
  }
  // ถ้าไม่ใช่ช่อง required จะยังไม่ถูกล้าง error จึงล้างตรงนี้
  clearError(`preferred-date-${n}`);
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
// ห้ามเลือกวันที่ย้อนหลัง (ปฏิทินจะเลือกวันที่ผ่านมาไม่ได้)
const today = new Date().toISOString().split("T")[0];
for (const n of [1, 2]) {
  const dateEl = document.getElementById(`preferred-date-${n}`);
  if (dateEl) {
    dateEl.min = today;
    dateEl.addEventListener("change", () => checkPastDate(n));
    const timeEl = document.getElementById(`preferred-time-${n}`);
    if (timeEl) timeEl.addEventListener("change", () => checkPastDate(n));
  }
}

// ใส่ชื่อ / ห้องของผู้พักอาศัย (ข้อมูลที่ login.js เก็บไว้)
const residentInfo = document.getElementById("resident-info");
const savedUser = JSON.parse(localStorage.getItem("user") || "null");
if (residentInfo && savedUser) {
  residentInfo.textContent = `${savedUser.name} · ห้อง ${savedUser.room}`;
}

// ---------- ตอนกดส่ง ----------
repairForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const firstInvalid = validateRequired();
  const date1Ok = checkPastDate(1);
  const date2Ok = checkPastDate(2);
  const imageMsg = validateImages(Array.from(imagesInput.files));
  imagesError.textContent = imageMsg;

  if (firstInvalid || !date1Ok || !date2Ok || imageMsg) {
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  const areaChecked = document.querySelector('input[name="area-type"]:checked');
  const data = {
    areaType: areaChecked ? areaChecked.value : "ROOM", // ROOM / COMMON
    building: document.getElementById("building").value,
    location: document.getElementById("location").value.trim(),
    category: document.getElementById("category").value,
    equipment: document.getElementById("equipment").value.trim(),
    description: document.getElementById("description").value.trim(),
    preferredDate1: document.getElementById("preferred-date-1").value,
    preferredTime1: document.getElementById("preferred-time-1").value,
    preferredDate2: document.getElementById("preferred-date-2").value,
    preferredTime2: document.getElementById("preferred-time-2").value,
    phone: document.getElementById("phone").value.trim(),
    lineId: document.getElementById("line-id").value.trim(),
    images: Array.from(imagesInput.files)
  };

  submitBtn.disabled = true; // กันกดซ้ำ
  try {
    const result = await submitRequest(data);
    // เก็บไว้ให้หน้า repair-success.html ใช้แสดงผล
    sessionStorage.setItem("lastRequest", JSON.stringify({
      id: result.id,
      status: result.status,
      date: data.preferredDate1,
      time: data.preferredTime1
    }));
    window.location.href = "repair-success.html";
  } catch (error) {
    alert("ส่งคำร้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    submitBtn.disabled = false;
  }
});