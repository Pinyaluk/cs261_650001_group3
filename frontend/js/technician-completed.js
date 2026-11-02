// Task49: ประวัติงานที่เสร็จแล้ว เชื่อมต่อ API จาก Task48
requireRole("TECHNICIAN");

(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    page: 0,
    // Trello Task49: Desktop 10 รายการ / Mobile 5 รายการต่อหน้า
    size: window.matchMedia("(max-width: 620px)").matches ? 5 : 10,
    keyword: "",
    sort: "newest",
    totalCount: 0,
    totalPages: 0,
    items: [],
    timer: null,
    loading: false
  };
  const body = $("completed-table-body");
  const notice = document.querySelector(".tech-notice");
  const search = $("completed-search");
  const sort = $("completed-sort");
  const pagination = document.querySelector(".tech-pagination");
  const paginationLabel = $("pagination-label");

  const mobileLogout = $("logout-btn-mobile");
  if (mobileLogout) mobileLogout.addEventListener("click", logout);

  function dateText(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(d);
  }

  function locationText(job) {
    return [job.building ? `อาคาร ${job.building}` : "", job.locationDetail || ""].filter(Boolean).join(" · ") || "-";
  }

  function setNotice(message, warning = false) {
    if (!notice) return;
    notice.className = `tech-notice${warning ? " warning" : ""}`;
    notice.replaceChildren();
    const span = document.createElement("span");
    span.textContent = message;
    notice.append(span);
    if (warning) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "tech-btn secondary";
      retry.style.marginLeft = "10px";
      retry.textContent = "ลองอีกครั้ง";
      retry.addEventListener("click", loadPage);
      notice.append(retry);
    }
  }

  function emptyRow(message) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    const empty = document.createElement("div");
    empty.className = "tech-empty";
    empty.textContent = message;
    td.append(empty);
    tr.append(td);
    return tr;
  }

  function renderRows() {
    if (!body) return;
    body.replaceChildren();
    let rows = [...state.items];
    if (state.sort === "oldest") {
      rows.sort((a, b) => new Date(a.completedAt || 0) - new Date(b.completedAt || 0));
    } else {
      rows.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
    }

    if (!rows.length) {
      body.append(emptyRow(state.keyword ? "ไม่พบงานที่ตรงกับคำค้นหา" : "ยังไม่มีงานที่เสร็จแล้ว"));
      return;
    }

    rows.forEach((job) => {
      const tr = document.createElement("tr");
      const titleCell = document.createElement("td");
      const titleLink = document.createElement("a");
      titleLink.className = "tech-link";
      titleLink.href = `technician-completed-detail.html?id=${encodeURIComponent(job.requestId)}`;
      titleLink.textContent = job.title || `งานซ่อม #${job.requestId}`;
      titleCell.append(titleLink);
      const location = document.createElement("td");
      location.textContent = locationText(job);
      const date = document.createElement("td");
      date.textContent = dateText(job.completedAt);
      const status = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "tech-pill status";
      badge.textContent = "เสร็จสิ้น";
      status.append(badge);
      const action = document.createElement("td");
      const view = document.createElement("a");
      view.className = "tech-link";
      view.href = titleLink.href;
      view.textContent = "ดูรายละเอียด ›";
      action.append(view);
      tr.append(titleCell, location, date, status, action);
      body.append(tr);
    });
  }

  function renderPagination() {
    if (!pagination) return;
    pagination.replaceChildren();
    const totalPages = state.totalPages;
    const current = state.page;
    if (paginationLabel) paginationLabel.textContent = state.totalCount
      ? `${(current * state.size) + 1}–${Math.min((current + 1) * state.size, state.totalCount)} จาก ${state.totalCount} รายการ`
      : "0 รายการ";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "‹";
    prev.setAttribute("aria-label", "หน้าก่อนหน้า");
    prev.disabled = current <= 0 || state.loading;
    prev.addEventListener("click", () => { if (state.page > 0) { state.page -= 1; loadPage(); } });

    const page = document.createElement("button");
    page.type = "button";
    page.className = "active";
    page.textContent = String(totalPages ? current + 1 : 0);
    page.disabled = true;

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "›";
    next.setAttribute("aria-label", "หน้าถัดไป");
    next.disabled = current + 1 >= totalPages || state.loading;
    next.addEventListener("click", () => { if (state.page + 1 < state.totalPages) { state.page += 1; loadPage(); } });

    pagination.append(prev, page, next);
  }

  async function loadPage() {
    state.loading = true;
    setNotice("กำลังโหลดประวัติงานที่เสร็จแล้ว…");
    if (body) body.replaceChildren(emptyRow("กำลังโหลดข้อมูล…"));
    renderPagination();
    try {
      const result = await getTechnicianCompletedJobs({
        page: state.page, size: state.size, keyword: state.keyword
      });
      state.items = Array.isArray(result?.content) ? result.content : [];
      state.totalCount = Number(result?.totalCount || 0);
      state.totalPages = Number(result?.totalPages || 0);
      if (state.totalPages > 0 && state.page >= state.totalPages) {
        state.page = state.totalPages - 1;
        state.loading = false;
        return loadPage();
      }
      renderRows();
      setNotice(state.totalCount ? `พบงานที่เสร็จแล้ว ${state.totalCount} รายการ` : "ขณะนี้ยังไม่มีประวัติงานที่เสร็จแล้ว");
    } catch (error) {
      state.items = [];
      state.totalCount = 0;
      state.totalPages = 0;
      if (body) body.replaceChildren(emptyRow(`โหลดประวัติงานไม่สำเร็จ: ${error.message || "เกิดข้อผิดพลาด"}`));
      setNotice(`โหลดประวัติงานไม่สำเร็จ: ${error.message || "เกิดข้อผิดพลาด"}`, true);
    } finally {
      state.loading = false;
      renderPagination();
    }
  }

  if (search) {
    search.addEventListener("input", () => {
      clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        state.keyword = search.value.trim();
        state.page = 0;
        loadPage();
      }, 350);
    });
  }
  if (sort) sort.addEventListener("change", () => {
    state.sort = sort.value;
    renderRows();
  });

  // ปรับจำนวนรายการต่อหน้าเมื่อเปลี่ยนขนาดหน้าจอ (Desktop 10 / Mobile 5)
  const mobileLayout = window.matchMedia("(max-width: 620px)");
  const updatePageSize = (event) => {
    const nextSize = event.matches ? 5 : 10;
    if (state.size !== nextSize) {
      state.size = nextSize;
      state.page = 0;
      loadPage();
    }
  };
  if (mobileLayout.addEventListener) {
    mobileLayout.addEventListener("change", updatePageSize);
  } else {
    // รองรับ Safari รุ่นเก่า
    mobileLayout.addListener(updatePageSize);
  }

  loadPage();
})();
