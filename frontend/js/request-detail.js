// js/request-detail.js
// หน้ารายละเอียดคำร้อง: อ่าน id จาก URL → เรียก API → เติมข้อมูลลงหน้า

requireLogin();

const id = getQueryParam("id");

// ใส่ข้อความลง element ตาม id (ถ้าหน้านั้นไม่มี element นี้ ก็ข้ามไป)
function setText(elId, text) {
  const el = document.getElementById(elId);
  if (el) el.textContent = text;
}

// ---------- ไทม์ไลน์ ----------
function renderTimeline(history) {
  const timeline = document.getElementById("timeline");
  const template = document.getElementById("timeline-item-template");
  if (!timeline || !template) return;

  // เรียงเก่าไปใหม่
  const sorted = [...(history || [])].sort(
    (a, b) => new Date(a.changedAt) - new Date(b.changedAt)
  );

  timeline.innerHTML = "";
  sorted.forEach((h, i) => {
    const clone = template.content.cloneNode(true);
    const item = clone.firstElementChild; // <li> ตัวนอกสุดของ template

    const statusInfo = STATUS[h.status];
    clone.querySelector('[data-field="title"]').textContent = statusInfo ? statusInfo.text : h.status;
    clone.querySelector('[data-field="time"]').textContent = formatDateTime(h.changedAt);

    const noteEl = clone.querySelector('[data-field="note"]');
    if (h.note) {
      noteEl.textContent = h.note;
    } else {
      noteEl.classList.add("is-hidden"); // ไม่มีหมายเหตุ ก็ซ่อน
    }

    // รายการสุดท้าย = สถานะปัจจุบัน (ยกเว้นเสร็จสิ้นแล้วให้ถือว่าครบ)
    const isLast = i === sorted.length - 1;
    item.classList.add(isLast && h.status !== "COMPLETED" ? "is-current" : "is-done");

    timeline.appendChild(clone);
  });
}

// ---------- รูปแนบ ----------
function renderImages(paths) {
  const list = document.getElementById("image-list");
  const template = document.getElementById("image-thumb-template");
  if (!list) return;

  list.innerHTML = "";
  (paths || []).forEach((path, i) => {
    const src = imageUrl(path); // เติม http://localhost:8080 ข้างหน้า

    if (template) {
      const clone = template.content.cloneNode(true);
      clone.querySelector('[data-field="img"]').src = src;
      clone.querySelector('[data-field="caption"]').textContent = "รูปที่ " + (i + 1);
      list.appendChild(clone);
    } else {
      // ถ้า HTML ยังไม่มี template ให้สร้างรูปเองไปก่อน
      const figure = document.createElement("figure");
      figure.className = "image-thumb";
      const img = document.createElement("img");
      img.src = src;
      img.alt = "รูปที่ " + (i + 1);
      figure.appendChild(img);
      list.appendChild(figure);
    }
  });
}

// ---------- เติมข้อมูลทั้งหน้า ----------
function renderRequest(r) {
  const room = `${r.building || ""} ${r.locationDetail || ""}`.trim();

  setText("request-title", r.title);
  renderStatusBadge(document.getElementById("request-status"), r.status);
  renderUrgencyBadge(document.getElementById("request-urgency"), r.urgency); // ถ้ามี element นี้

  setText("request-meta",
    `#${r.requestId} · ${categoryText(r.category)} · ${room} · แจ้งเมื่อ ${formatDate(r.createdAt)}`);
  if (r.updatedAt) setText("updated-at", "อัปเดต " + formatDateTime(r.updatedAt));

  setText("request-description", r.description);
  setText("category", categoryText(r.category));
  setText("room", room);
  setText("contact-phone", r.contactPhone);

  // วันนัดหมาย (null = รอยืนยัน)
  setText("appointment-datetime",
    r.appointmentDateTime ? formatDateTime(r.appointmentDateTime) : "รอเจ้าหน้าที่ยืนยัน");

  // ช่าง (technician เป็น null = ยังไม่มอบหมาย)
  const techPhone = document.getElementById("technician-phone");
  if (r.technician) {
    setText("technician-name", r.technician.name);
    if (techPhone) {
      techPhone.textContent = r.technician.phone || "ยังไม่มีเบอร์ติดต่อ";
      techPhone.href = r.technician.phone ? "tel:" + r.technician.phone : "#";
    }
  } else {
    setText("technician-name", "ยังไม่มอบหมายช่าง");
    if (techPhone) {
      techPhone.textContent = "ยังไม่มีเบอร์ติดต่อ";
      techPhone.href = "#";
    }
  }

  // เจ้าหน้าที่หอพัก: API ยังไม่มีข้อมูล ใช้เบอร์สำนักงานไปก่อน
  setText("staff-name", "สำนักงานหอพัก");
  const staffPhone = document.getElementById("staff-phone");
  if (staffPhone) {
    staffPhone.textContent = "02-555-0180";
    staffPhone.href = "tel:025550180";
  }

  renderTimeline(r.statusHistory);
  renderImages(r.imageUrls);
}

// ---------- ไม่พบคำร้อง ----------
function showNotFound() {
  const box = document.getElementById("not-found"); // nathan จะเพิ่มให้
  if (box) {
    box.classList.remove("is-hidden");
  }
  // กันไม่ให้เห็นข้อมูลตัวอย่างที่ค้างอยู่ใน HTML
  setText("request-title", "ไม่พบคำร้อง");
  setText("request-meta", "");
}

// ---------- เริ่มทำงาน ----------
async function init() {
  if (!id) {
    window.location.replace("history.html"); // เปิดหน้านี้ตรงๆ โดยไม่มีเลขคำร้อง
    return;
  }
  try {
    const request = await getRequestById(id);
    if (!request) {
      showNotFound();
      return;
    }
    renderRequest(request);
  } catch (err) {
    setText("request-title", "โหลดข้อมูลไม่สำเร็จ");
    setText("request-meta", err.message);
  }
}
init();