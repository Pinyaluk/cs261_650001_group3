// js/request-check.js
// หน้าตรวจสอบคำร้อง: อ่าน id จาก URL → เรียก API → เติมข้อมูลลงหน้า

requireLogin();

const id = getQueryParam("id");

const backBtn = document.querySelector(".back-btn");
if (backBtn && document.referrer.includes("home.html")) {
  backBtn.href = "home.html";
  backBtn.setAttribute("aria-label", "กลับหน้าหลัก");
}

function setText(elId, text) {
  const el = document.getElementById(elId);
  if (el) el.textContent = text;
}

function renderImages(paths) {
  const list = document.getElementById("image-list");
  const template = document.getElementById("image-thumb-template");
  if (!list) return;
  list.innerHTML = "";
  (paths || []).forEach((path, i) => {
    const src = imageUrl(path);
    if (template) {
      const clone = template.content.cloneNode(true);
      clone.querySelector('[data-field="img"]').src = src;
      clone.querySelector('[data-field="caption"]').textContent = "รูปที่ " + (i + 1);
      list.appendChild(clone);
    } else {
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

function slotText(date, slot) {
  if (!date) return "";
  return `${formatDate(date)} · ${timeSlotText(slot)}`;
}

function renderRequest(r) {
  const room = `${r.building || ""} ${r.locationDetail || ""}`.trim();

  setText("request-title", r.title);
  renderStatusBadge(document.getElementById("request-status"), r.status);
  renderUrgencyBadge(document.getElementById("request-urgency"), r.urgency);

  // วันที่แจ้ง: ใช้ประวัติสถานะรายการแรก (เก่าสุด)
  const history = [...(r.statusHistory || [])].sort(
    (a, b) => new Date(a.changedAt) - new Date(b.changedAt)
  );
  const createdAt = r.createdAt || (history.length ? history[0].changedAt : null);
  setText("request-code", `เลขคำร้อง #${r.requestId} · แจ้งเมื่อ ${formatDate(createdAt)}`);

  setText("area-type", r.locationType ? locationTypeText(r.locationType) : "-");
  setText("location", room || "-");
  setText("category", categoryText(r.category));
  setText("equipment", r.title);
  setText("description", r.description);

  const times = [
    slotText(r.preferredDate1, r.preferredSlot1),
    slotText(r.preferredDate2, r.preferredSlot2)
  ].filter(Boolean);
  setText("preferred-times", times.length ? times.join("\n") : "-"); // แยกบรรทัดละช่วงตาม Figma

  const name = localStorage.getItem("fullName") || "";
  const line = r.lineId ? ` · LINE ${r.lineId}` : "";
  setText("contact-info", (`${name} ${r.contactPhone || ""}`.trim() + line) || "-");

  renderImages(r.imageUrls);
  const imageCount = (r.imageUrls || []).length;
  setText("image-count", imageCount ? `(${imageCount} รูป)` : "");

  const detailLink = document.getElementById("detail-link");
  if (detailLink) detailLink.href = "request-detail.html?id=" + encodeURIComponent(r.requestId);
}

async function init() {
  if (!id) {
    window.location.replace("history.html");
    return;
  }
  try {
    const request = await getRequestById(id);
    if (!request) {
      window.location.replace("history.html"); // ไม่พบคำร้อง → กลับหน้าประวัติ
      return;
    }
    renderRequest(request);
  } catch (err) {
    setText("request-title", "โหลดข้อมูลไม่สำเร็จ");
    setText("request-code", err.message);
  }
}
init();