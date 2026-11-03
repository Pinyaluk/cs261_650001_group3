// js/technician-submit.js
// หน้าช่างส่งมอบงาน (U8): กรอกผลการซ่อม + แนบรูปหลังซ่อม 1–3 รูป แล้วส่งไป
//   POST /api/technician/repair-requests/{id}/complete  (multipart)
// ข้อมูลงานด้านขวาดึงจาก GET /api/staff/repair-requests/{id}

requireRole("TECHNICIAN");

(function () {
  "use strict";

  // ---------- ค่าคงที่ (ใช้ชุดเดียวกับ repair-form.js) ----------
  const MAX_FILES = 3;
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png"];

  const SLOT_LABELS = {
    MORNING: "ช่วงเช้า 09:00–12:00 น.",
    AFTERNOON: "ช่วงบ่าย 13:00–16:00 น."
  };
  const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  // ---------- หา element ----------
  const $ = (id) => document.getElementById(id);
  const form = $("submit-form");
  const resultInput = $("repair-result");
  const imagesInput = $("images");
  const imagePreview = $("image-preview");
  const imageCount = $("image-count");
  const submitBtn = $("submit-btn");

  const requestId = new URLSearchParams(window.location.search).get("id");
  const detailUrl = "technician-task-detail.html?id=" + encodeURIComponent(requestId || "");

  let rejectedImagesMessage = ""; // เหตุผลที่รูปชุดล่าสุดถูกปฏิเสธ แสดงต่อตอนกดส่ง
  let previewUrls = [];           // เก็บไว้ revoke กัน memory รั่ว
  let canSubmit = false;          // false ถ้างานไม่ได้อยู่ในสถานะกำลังดำเนินการ

  form.noValidate = true;

  // ---------- helper ----------
  function setHidden(node, hidden) {
    if (node) node.classList.toggle("is-hidden", hidden);
  }

  // ใส่ข้อความเตือนใต้ช่อง + ใส่ is-invalid ให้ .form-group (ไม่งั้น .error-msg ถูกซ่อน)
  function setFieldError(errorId, message) {
    const errorEl = $(errorId);
    errorEl.textContent = message;
    const group = errorEl.closest(".form-group");
    if (group) group.classList.toggle("is-invalid", message !== "");
  }

  function setFormError(message) {
    const el = $("form-error");
    el.textContent = message;
    el.classList.toggle("is-visible", message !== "");
  }

  function formatDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
    if (!m) return "";
    return `${Number(m[3])} ${TH_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
  }

  function formatDateTime(value) {
    const d = new Date(value);
    if (!value || Number.isNaN(d.getTime())) return "-";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} • ${hh}:${mm} น.`;
  }

  // ---------- ข้อมูลงานด้านขวา ----------
  function renderJob(job) {
    $("job-title").textContent = job.title || "-";

    const place = [job.building && "อาคาร " + job.building, job.locationDetail].filter(Boolean).join(" • ");
    $("job-location").textContent = place || "-";

    const appt = [formatDate(job.appointmentDate), SLOT_LABELS[job.appointmentSlot]].filter(Boolean).join(" ");
    $("job-appointment").textContent = appt || "-";

    $("job-reporter").textContent = [job.reporterName, job.reporterPhone].filter(Boolean).join(" • ") || "-";

    setHidden($("job-loading"), true);
    setHidden($("job-facts"), false);
  }

  function showPageError(message) {
    setHidden($("submit-view"), true);
    $("page-error-message").textContent = message;
    $("page-error-back").href = "technician-tasks.html";
    setHidden($("page-error"), false);
  }

  async function loadJob() {
    try {
      const job = await apiFetch("/api/staff/repair-requests/" + encodeURIComponent(requestId));
      renderJob(job);
      $("job-title").dataset.title = job.title || "";

      // ส่งมอบได้เฉพาะงานที่กำลังดำเนินการ
      if (job.status !== "IN_PROGRESS") {
        canSubmit = false;
        submitBtn.disabled = true;
        setFormError(job.status === "COMPLETED"
          ? "งานนี้ส่งมอบแล้ว ไม่สามารถส่งมอบซ้ำได้"
          : "งานนี้ไม่ได้อยู่ในสถานะกำลังดำเนินการ ไม่สามารถส่งมอบได้");
      } else {
        canSubmit = true;
      }
    } catch (err) {
      if (err.status === 403) showPageError("งานนี้ไม่ได้ถูกมอบหมายให้คุณ จึงไม่สามารถส่งมอบได้");
      else if (err.status === 404) showPageError("ไม่พบงานนี้ในระบบ");
      else showPageError(err.message);
    }
  }

  // ---------- ตรวจรูป (เหมือน repair-form.js) ----------
  function validateImages(files, requireOne) {
    if (requireOne && files.length === 0) return "กรุณาแนบรูปหลังซ่อมอย่างน้อย 1 รูป";
    if (files.length > MAX_FILES) return "แนบรูปได้ไม่เกิน 3 รูป";
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_SIZE) {
        return "รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB";
      }
    }
    return "";
  }

  function clearPreview() {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    previewUrls = [];
    imagePreview.innerHTML = "";
  }

  imagesInput.addEventListener("change", () => {
    const files = Array.from(imagesInput.files);
    clearPreview();
    imageCount.textContent = `แนบรูปแล้ว 0 จาก ${MAX_FILES} รูป`;

    const message = validateImages(files, false);
    if (message) {
      rejectedImagesMessage = message;
      setFieldError("images-error", message);
      imagesInput.value = ""; // ล้างไฟล์ที่ไม่ผ่านทิ้ง
      return;
    }
    rejectedImagesMessage = "";
    setFieldError("images-error", "");

    const template = $("image-thumb-template");
    for (const file of files) {
      const clone = template.content.cloneNode(true);
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const img = clone.querySelector('[data-field="img"]');
      img.src = url;
      img.alt = file.name;
      clone.querySelector('[data-field="caption"]').textContent = file.name;
      imagePreview.appendChild(clone);
    }
    imageCount.textContent = `แนบรูปแล้ว ${files.length} จาก ${MAX_FILES} รูป`;
  });

  resultInput.addEventListener("input", () => {
    if (resultInput.value.trim() !== "") setFieldError("repair-result-error", "");
  });

  // ---------- หน้าสำเร็จ ----------
  function showSuccess(data) {
    setHidden($("submit-view"), true);
    setHidden($("success-view"), false);

    $("success-title").textContent = $("job-title").dataset.title || "#" + requestId;
    $("success-result").textContent = data.repairResult || resultInput.value.trim();
    $("success-time").textContent = formatDateTime(data.completedAt);
    $("success-detail-link").href = detailUrl;

    const box = $("success-images");
    box.innerHTML = "";
    (data.afterImageUrls || []).forEach((path, i) => {
      const fig = document.createElement("figure");
      fig.className = "thumb";
      const img = document.createElement("img");
      img.src = imageUrl(path);
      img.alt = "รูปหลังซ่อมที่ " + (i + 1);
      fig.appendChild(img);
      box.appendChild(fig);
    });
    window.scrollTo({ top: 0 });
  }

  // ---------- ตอนกดส่ง ----------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    // 1) ผลการซ่อม
    const result = resultInput.value.trim();
    const resultMsg = result === "" ? "กรุณากรอกผลการซ่อม" : "";
    setFieldError("repair-result-error", resultMsg);

    // 2) รูป
    const files = Array.from(imagesInput.files);
    const imageMsg = files.length === 0 && rejectedImagesMessage
      ? rejectedImagesMessage
      : validateImages(files, true);
    setFieldError("images-error", imageMsg);

    if (resultMsg || imageMsg) {
      setFormError("กรุณากรอกข้อมูลให้ครบ");
      if (resultMsg) resultInput.focus();
      return;
    }
    setFormError("");

    // 3) ส่ง FormData (ห้ามตั้ง Content-Type เอง)
    const formData = new FormData();
    formData.append("repairResult", result);
    for (const file of files) {
      formData.append("afterImages", file); // ชื่อ "afterImages" ทีละรูป
    }

    submitBtn.disabled = true; // กันกดซ้ำ
    submitBtn.textContent = "กำลังส่งมอบ...";
    try {
      const data = await apiFetch(
        "/api/technician/repair-requests/" + encodeURIComponent(requestId) + "/complete",
        { method: "POST", body: formData }
      );
      showSuccess(data);
    } catch (err) {
      // 400 = ข้อความจาก backend (เช่น ส่งมอบซ้ำ / ไม่ใช่ช่างที่รับงาน) · 0 = ต่อเซิร์ฟเวอร์ไม่ได้
      setFormError(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "ยืนยันส่งมอบงาน";
    }
  });

  // ---------- เริ่มทำงาน ----------
  $("tech-name").textContent = localStorage.getItem("fullName") || "ช่าง";
  $("logout-btn").addEventListener("click", () => logout());

  if (!requestId) {
    showPageError("ไม่พบเลขงานใน URL (ต้องมี ?id=...)");
  } else {
    $("back-link").href = detailUrl;
    $("cancel-link").href = detailUrl;
    loadJob();
  }
})();