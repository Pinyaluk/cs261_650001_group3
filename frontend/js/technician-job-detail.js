// Task49: รายละเอียดงานที่กำลังดำเนินการ
requireRole("TECHNICIAN");

(() => {
  const $ = (id) => document.getElementById(id);
  const id = getQueryParam("id");
  const notice = $("detail-api-notice");
  const mobileLogout = $("logout-btn-mobile");
  if (mobileLogout) mobileLogout.addEventListener("click", logout);

    if (!id) {
    if (notice) notice.textContent = "ยังไม่ได้ระบุเลขที่งาน · กลับไปเลือกงานจากรายการงานของฉัน";
    return;
  }

  function setText(elementId, value, fallback = "-") {
    const el = $(elementId);
    if (el) el.textContent = value === null || value === undefined || value === "" ? fallback : String(value);
  }

  function dateOnly(value) {
    if (!value) return "-";
    const raw = String(value);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(d);
  }

  function renderPhotos(container, paths, emptyText) {
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(paths) || !paths.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "tech-photo-placeholder";
      placeholder.textContent = emptyText;
      container.append(placeholder);
      return;
    }
    paths.forEach((path) => {
      const img = document.createElement("img");
      img.src = imageUrl(path);
      img.alt = "รูปภาพประกอบคำร้อง";
      img.loading = "lazy";
      img.onerror = () => {
        const fallback = document.createElement("div");
        fallback.className = "tech-photo-placeholder";
        fallback.textContent = "ไม่สามารถโหลดรูปภาพได้";
        img.replaceWith(fallback);
      };
      container.append(img);
    });
  }

  function renderTimeline(history) {
    const timeline = document.querySelector(".tech-timeline");
    if (!timeline) return;
    timeline.replaceChildren();
    const labels = { PENDING: "รับเรื่อง", IN_PROGRESS: "กำลังดำเนินการ", COMPLETED: "เสร็จสิ้น" };
    if (!Array.isArray(history) || !history.length) {
      const item = document.createElement("div");
      item.className = "tech-timeline-item";
      item.textContent = "ไม่มีประวัติสถานะ";
      timeline.append(item);
      return;
    }
    history.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "tech-timeline-item";
      const title = document.createElement("strong");
      title.textContent = labels[entry.status] || entry.status || "อัปเดตสถานะ";
      const meta = document.createElement("span");
      const parts = [entry.changedAt ? formatDateTime(entry.changedAt) : "", entry.changedByName || "", entry.note || ""].filter(Boolean);
      meta.textContent = parts.join(" · ") || "-";
      item.append(title, meta);
      timeline.append(item);
    });
  }

  async function loadDetail() {
    if (notice) notice.textContent = "กำลังโหลดรายละเอียดงาน…";
    try {
      const job = await getTechnicianJobDetail(id);
      setText("detail-request-id", `เลขที่งาน #${job.requestId}`);
      setText("detail-title", job.title, "รายละเอียดคำร้อง");
      setText("detail-meta", `#${job.requestId} · ${categoryText(job.category)} · ${(STATUS[job.status] || {}).text || job.status}`);
      setText("detail-area-type", locationTypeText(job.locationType));
      setText("detail-location", [   job.building || "", job.locationDetail || ""].filter(Boolean).join(" · "));
      setText("detail-category", categoryText(job.category));
      setText("detail-equipment", job.title);
      setText("detail-description", job.description);
      setText("detail-appointment-date", dateOnly(job.appointmentDate || job.preferredDate1));
      setText("detail-appointment-slot", timeSlotText(job.appointmentSlot || job.preferredSlot1));
      setText("detail-contact-name", job.reporterName);
      setText("detail-contact-phone", job.reporterPhone);
      const statusPill = document.querySelector(".tech-task-tags .tech-pill.status");
      if (statusPill) statusPill.textContent = job.status === "COMPLETED" ? "เสร็จสิ้น" : "กำลังดำเนินการ";
            const handover = $("handover-btn");
      if (handover) {
        handover.href = "technician-submit.html?id=" + encodeURIComponent(job.requestId);
        handover.hidden = job.status === "COMPLETED";
      }
      renderPhotos($("request-photos"), job.imageUrls, "ไม่มีรูปภาพประกอบ");
      renderTimeline(job.statusHistory);
      if (notice) {
        notice.className = "tech-notice";
        notice.textContent = "โหลดรายละเอียดงานเรียบร้อย";
      }
    } catch (error) {
      if (notice) {
        notice.className = "tech-notice warning";
        notice.textContent = `ไม่สามารถโหลดรายละเอียดงานได้: ${error.message || "เกิดข้อผิดพลาด"}`;
      }
    }
  }

  loadDetail();
})();
