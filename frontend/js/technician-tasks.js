// Task49: รายการงานของช่าง เชื่อมต่อ API จาก Task48
requireRole("TECHNICIAN");

(() => {
  const $ = (id) => document.getElementById(id);
  const state = { jobs: [], loading: false, error: null };

  const els = {
    notice: $("api-notice"),
    search: $("task-search"),
    filter: $("task-filter"),
    today: $("today-list"),
    tomorrow: $("tomorrow-list"),
    upcoming: $("upcoming-list"),
    todayCount: $("today-count"),
    tomorrowCount: $("tomorrow-count"),
    upcomingCount: $("upcoming-count"),
    total: $("stat-total"),
    todayStat: $("stat-today"),
    urgent: $("stat-urgent"),
    progress: $("stat-progress")
  };

  const mobileLogout = $("logout-btn-mobile");
  if (mobileLogout) mobileLogout.addEventListener("click", logout);

  function localDateKey(value) {
    if (!value) return "";
    const raw = String(value);
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dateKeyOffset(offset) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function thaiDate(value) {
    if (!value) return "ไม่ระบุวันนัด";
    const key = localDateKey(value);
    if (!key) return "ไม่ระบุวันนัด";
    const [year, month, day] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" })
      .format(new Date(year, month - 1, day));
  }

  function locationText(job) {
    return [   job.building || "", job.locationDetail || ""].filter(Boolean).join(" · ") || "ไม่ระบุสถานที่";
  }

  function filteredJobs() {
    const keyword = (els.search?.value || "").trim().toLocaleLowerCase("th");
    const category = els.filter?.value || "all";
    return state.jobs.filter((job) => {
      const matchesCategory = category === "all" || job.category === category;
      const haystack = [job.requestId, job.title, job.building, job.locationDetail, job.reporterName, job.category]
        .filter((v) => v !== null && v !== undefined).join(" ").toLocaleLowerCase("th");
      return matchesCategory && (!keyword || haystack.includes(keyword));
    });
  }

  function createEmpty(message) {
    const box = document.createElement("div");
    box.className = "tech-empty";
    box.textContent = message;
    return box;
  }

  function createJobCard(job) {
    const link = document.createElement("a");
    link.className = "tech-card tech-task";
    link.href = `technician-job-detail.html?id=${encodeURIComponent(job.requestId)}`;

    const main = document.createElement("div");
    main.className = "tech-task-main";
    const tags = document.createElement("div");
    tags.className = "tech-task-tags";

    const category = document.createElement("span");
    category.className = "tech-pill";
    category.textContent = categoryText(job.category);
    tags.append(category);

    const status = document.createElement("span");
    status.className = "tech-pill status";
    status.textContent = "กำลังดำเนินการ";
    tags.append(status);

    if (job.urgency === "URGENT") {
      const urgent = document.createElement("span");
      urgent.className = "tech-pill urgent";
      urgent.textContent = "เร่งด่วน";
      tags.append(urgent);
    }

    const title = document.createElement("h3");
    title.textContent = job.title || `งานซ่อม #${job.requestId}`;
    const meta = document.createElement("p");
    meta.textContent = `#${job.requestId} · ${locationText(job)} · ${thaiDate(job.appointmentDate)} · ${timeSlotText(job.appointmentSlot || "")}`;
    const reporter = document.createElement("p");
    reporter.textContent = `ผู้แจ้ง: ${job.reporterName || "ไม่ระบุ"}${job.reporterPhone ? ` · ${job.reporterPhone}` : ""}`;

    main.append(tags, title, meta, reporter);
    const arrow = document.createElement("span");
    arrow.className = "tech-task-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "›";
    link.append(main, arrow);
    return link;
  }

  function showNotice(message, type = "info", withRetry = false) {
    if (!els.notice) return;
    els.notice.className = `tech-notice${type === "warning" ? " warning" : ""}`;
    els.notice.replaceChildren();
    const text = document.createElement("span");
    text.textContent = message;
    els.notice.append(text);
    if (withRetry) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "tech-btn secondary";
      retry.style.marginLeft = "10px";
      retry.textContent = "ลองอีกครั้ง";
      retry.addEventListener("click", loadJobs);
      els.notice.append(retry);
    }
  }

  function render() {
    const jobs = filteredJobs();
    const todayKey = dateKeyOffset(0);
    const tomorrowKey = dateKeyOffset(1);
    const groups = { today: [], tomorrow: [], upcoming: [] };

    jobs.forEach((job) => {
      const key = localDateKey(job.appointmentDate);
      if (key === todayKey || (key && key < todayKey)) groups.today.push(job);
      else if (key === tomorrowKey) groups.tomorrow.push(job);
      else groups.upcoming.push(job);
    });

    const fill = (container, rows, emptyMessage) => {
      if (!container) return;
      container.replaceChildren();
      if (!rows.length) {
        container.append(createEmpty(emptyMessage));
        return;
      }
      rows.forEach((job) => container.append(createJobCard(job)));
    };

    fill(els.today, groups.today, "ไม่มีงานที่นัดหมายวันนี้");
    fill(els.tomorrow, groups.tomorrow, "ไม่มีงานที่นัดหมายพรุ่งนี้");
    fill(els.upcoming, groups.upcoming, "ไม่มีงานในวันถัดไป");
    if (els.todayCount) els.todayCount.textContent = groups.today.length;
    if (els.tomorrowCount) els.tomorrowCount.textContent = groups.tomorrow.length;
    if (els.upcomingCount) els.upcomingCount.textContent = groups.upcoming.length;

    const setStat = (el, value) => { if (el) el.textContent = Number(value).toLocaleString("th-TH"); };
    setStat(els.total, state.jobs.length);
    setStat(els.todayStat, state.jobs.filter((j) => localDateKey(j.appointmentDate) === todayKey).length);
    setStat(els.urgent, state.jobs.filter((j) => j.urgency === "URGENT").length);
    setStat(els.progress, state.jobs.length);
  }

  async function loadJobs() {
    state.loading = true;
    showNotice("กำลังโหลดงานที่ได้รับมอบหมาย…");
    [els.today, els.tomorrow, els.upcoming].forEach((el) => {
      if (el) el.replaceChildren(createEmpty("กำลังโหลดข้อมูล…"));
    });
    try {
      const data = await getTechnicianAssignedJobs();
      state.jobs = Array.isArray(data) ? data : [];
      state.error = null;
      render();
      showNotice(state.jobs.length ? `แสดงงานที่ได้รับมอบหมาย ${state.jobs.length} รายการ` : "ขณะนี้ยังไม่มีงานที่ได้รับมอบหมาย");
    } catch (error) {
      state.error = error;
      state.jobs = [];
      render();
      showNotice(`โหลดรายการงานไม่สำเร็จ: ${error.message || "เกิดข้อผิดพลาด"}`, "warning", true);
    } finally {
      state.loading = false;
    }
  }

  if (els.search) els.search.addEventListener("input", render);
  if (els.filter) els.filter.addEventListener("change", render);
  loadJobs();
})();
