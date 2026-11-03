// Task49: รายละเอียดงานที่เสร็จแล้ว
requireRole("TECHNICIAN");

(() => {
  const $ = (id) => document.getElementById(id);
  const id = getQueryParam("id");
  const notice = document.querySelector(".tech-notice");
  const mobileLogout = $("logout-btn-mobile");
  if (mobileLogout) mobileLogout.addEventListener("click", logout);

    if (!id) {
    if (notice) notice.textContent = "ยังไม่ได้ระบุเลขที่งาน · กลับไปเลือกงานจากรายการงานที่เสร็จแล้ว";
    return;
  }

  function setText(elementId, value, fallback = "-") {
    const el = $(elementId);
    if (el) el.textContent = value === null || value === undefined || value === "" ? fallback : String(value);
  }

  function dateText(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(d);
  }

  function renderPhoto(target, paths, label) {
    if (!target) return;
    target.replaceChildren();
    if (!Array.isArray(paths) || !paths.length) {
      target.className = "tech-photo-placeholder";
      target.textContent = `ไม่มี${label}`;
      return;
    }
    target.className = "tech-photo-stack";
    paths.forEach((path) => {
      const img = document.createElement("img");
      img.src = imageUrl(path);
      img.alt = label;
      img.loading = "lazy";
      img.onerror = () => {
        const fallback = document.createElement("span");
        fallback.className = "tech-photo-placeholder";
        fallback.textContent = "ไม่สามารถโหลดรูปภาพได้";
        img.replaceWith(fallback);
      };
      target.append(img);
    });
  }

  function renderTimeline(history) {
    const timeline = document.querySelector(".tech-timeline");
    if (!timeline) return;
    timeline.replaceChildren();
    const labels = { PENDING: "รับเรื่อง", IN_PROGRESS: "ดำเนินการซ่อม", COMPLETED: "เสร็จสิ้น" };
    (Array.isArray(history) ? history : []).forEach((entry) => {
      const item = document.createElement("div");
      item.className = "tech-timeline-item";
      const title = document.createElement("strong");
      title.textContent = labels[entry.status] || entry.status || "อัปเดตสถานะ";
      const meta = document.createElement("span");
      meta.textContent = [entry.changedAt ? dateText(entry.changedAt) : "", entry.changedByName || "", entry.note || ""].filter(Boolean).join(" · ") || "-";
      item.append(title, meta);
      timeline.append(item);
    });
    if (!timeline.children.length) {
      const item = document.createElement("div");
      item.className = "tech-timeline-item";
      item.textContent = "ไม่มีประวัติสถานะ";
      timeline.append(item);
    }
  }

  async function loadDetail() {
    if (notice) notice.textContent = "กำลังโหลดรายละเอียดงาน…";
    try {
      const job = await getTechnicianJobDetail(id);
      setText("completed-request-id", `เลขที่งาน #${job.requestId}`);
      setText("completed-title", job.title, "รายละเอียดคำร้อง");
      setText("completed-meta", `#${job.requestId} · ${categoryText(job.category)} · เสร็จสิ้น`);
      setText("completed-location", [job.building || "", job.locationDetail || ""].filter(Boolean).join(" · "));
      setText("completed-category", categoryText(job.category));
      setText("completed-equipment", job.title);
      setText("completed-date", dateText(job.completedAt));
      setText("completed-description", job.description);
      setText("repair-result", job.repairResult);
      setText("completed-technician", job.technician?.name);
      setText("completed-handover-date", dateText(job.completedAt));
      renderPhoto($("before-photo"), job.imageUrls, "รูปก่อนซ่อม");
      renderPhoto($("after-photo"), job.afterImageUrls, "รูปหลังซ่อม");
      renderTimeline(job.statusHistory);
      if (notice) {
        notice.className = "tech-notice";
        notice.textContent = "โหลดประวัติงานเรียบร้อย";
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
