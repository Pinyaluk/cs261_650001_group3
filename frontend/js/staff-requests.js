// js/staff-requests.js
// หน้ารายการคำร้อง (เจ้าหน้าที่) — ดึงข้อมูลจริงจาก GET /api/staff/repair-requests ผ่าน apiFetch (api-client.js)
 
window.__staffListLoaded = true;
 
try {
  if (typeof requireRole === "function") requireRole("STAFF");
} catch (error) {
  console.error("requireRole failed:", error);
}
 
(function () {
  "use strict";
 
  /* ========================================
     ค่าคงที่
  ======================================== */
 
  const DESKTOP_QUERY = window.matchMedia("(min-width: 1024px)");
  const PAGE_SIZE = { desktop: 10, mobile: 5 };
  const SEARCH_DELAY_MS = 300;
  const DETAIL_PAGE = "staff-request-detail.html";
 
  const STATUS_META = {
    PENDING: { label: "รอรับเรื่อง", className: "badge--pending" },
    IN_PROGRESS: { label: "กำลังดำเนินการ", className: "badge--in-progress" },
    COMPLETED: { label: "เสร็จสิ้น", className: "badge--completed" },
  };
 
  const STATUS_ALIASES = {
    "รอรับเรื่อง": "PENDING",
    "กำลังดำเนินการ": "IN_PROGRESS",
    "เสร็จสิ้น": "COMPLETED",
    OPEN: "PENDING",
    NEW: "PENDING",
    ASSIGNED: "IN_PROGRESS",
    DONE: "COMPLETED",
    CLOSED: "COMPLETED",
  };
 
  const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
 
  /* ========================================
     State
  ======================================== */
 
  const state = {
    status: "ALL",
    search: "",
    page: 1,
    pageSize: currentPageSize(),
    token: 0,          // กันผลลัพธ์เก่าทับผลลัพธ์ใหม่
    clientRows: null,  // ใช้เมื่อ API คืนรายการทั้งหมดเป็น array
    counts: null,
  };
 
  const els = {};
 
  /* ========================================
     เริ่มทำงาน
  ======================================== */
 
  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    readUrlState();
    syncControlsFromState();
    bindEvents();
    showUserName();
    loadRequests();
  });
 
  function cacheElements() {
    const $ = (id) => document.getElementById(id);
    Object.assign(els, {
      search: $("search-input"),
      chips: Array.from(document.querySelectorAll("#status-filter .chip")),
      resultCount: $("result-count"),
      loading: $("loading-state"),
      error: $("error-state"),
      errorMessage: $("error-message"),
      retry: $("retry-btn"),
      empty: $("empty-state"),
      tableWrap: $("request-table-wrap"),
      tableBody: $("request-table-body"),
      tableHint: $("table-hint"),
      list: $("request-list"),
      pagination: $("pagination"),
      pageList: $("page-list"),
      prev: $("previous-page-btn"),
      next: $("next-page-btn"),
      info: $("pagination-info"),
      rowTemplate: $("request-row-template"),
      itemTemplate: $("request-item-template"),
      countPending: $("count-pending"),
      countInProgress: $("count-in-progress"),
      countCompleted: $("count-completed"),
      countUrgent: $("count-urgent"),
    });
  }
 
  function bindEvents() {
    document.querySelectorAll(".js-logout").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof logoutStaff === "function") logoutStaff();
        else if (typeof logout === "function") logout();
      });
    });
 
    let timer = null;
    els.search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.search = els.search.value.trim();
        state.page = 1;
        loadRequests();
      }, SEARCH_DELAY_MS);
    });
    els.search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.preventDefault();
    });
 
    els.chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const status = chip.dataset.status || "ALL";
        if (status === state.status) return;
        state.status = status;
        state.page = 1;
        syncControlsFromState();
        loadRequests();
      });
    });
 
    els.prev.addEventListener("click", () => goToPage(state.page - 1));
    els.next.addEventListener("click", () => goToPage(state.page + 1));
    els.pageList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-page]");
      if (btn) goToPage(Number(btn.dataset.page));
    });
 
    els.retry.addEventListener("click", () => {
      state.clientRows = null;
      loadRequests();
    });
 
    els.tableBody.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const row = e.target.closest("tr[data-href]");
      if (row) window.location.href = row.dataset.href;
    });
 
    const onViewportChange = () => {
      const newSize = currentPageSize();
      if (newSize === state.pageSize) return;
      const firstIndex = (state.page - 1) * state.pageSize;
      state.pageSize = newSize;
      state.page = Math.floor(firstIndex / newSize) + 1;
      loadRequests();
    };
    if (DESKTOP_QUERY.addEventListener) DESKTOP_QUERY.addEventListener("change", onViewportChange);
    else DESKTOP_QUERY.addListener(onViewportChange);
  }
 
  function currentPageSize() {
    return DESKTOP_QUERY.matches ? PAGE_SIZE.desktop : PAGE_SIZE.mobile;
  }
 
  function goToPage(page) {
    if (!Number.isFinite(page) || page < 1 || page === state.page) return;
    state.page = page;
    loadRequests();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
 
  function showUserName() {
    let name = "";
    ["getCurrentUser", "getSessionUser", "getUser"].some((fn) => {
      if (typeof window[fn] !== "function") return false;
      try {
        const user = window[fn]();
        name = (user && (user.fullName || user.name || user.displayName)) || "";
      } catch (_) {
        name = "";
      }
      return Boolean(name);
    });
    if (!name) return;
    document.querySelectorAll(".js-user-name").forEach((el) => {
      el.textContent = name;
    });
  }
 
  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const status = (params.get("status") || "ALL").toUpperCase();
    if (status === "ALL" || STATUS_META[status]) state.status = status;
    state.search = (params.get("q") || "").trim();
    const page = parseInt(params.get("page"), 10);
    state.page = page > 0 ? page : 1;
  }
 
  function writeUrlState() {
    const params = new URLSearchParams();
    if (state.status !== "ALL") params.set("status", state.status);
    if (state.search) params.set("q", state.search);
    if (state.page > 1) params.set("page", String(state.page));
    const qs = params.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }
 
  function syncControlsFromState() {
    els.search.value = state.search;
    els.chips.forEach((chip) => {
      const active = (chip.dataset.status || "ALL") === state.status;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  }
 
  function detailUrl(req) {
    const params = new URLSearchParams({ id: req.id });
    params.set("returnStatus", state.status);
    params.set("returnPage", String(state.page));
    if (state.search) params.set("returnQ", state.search);
    return `${DETAIL_PAGE}?${params.toString()}`;
  }
 
  async function loadRequests() {
    const token = ++state.token;
    showLoading();
 
    try {
      const result = await fetchPage();
      if (token !== state.token) return;
 
      const totalPages = Math.max(1, Math.ceil(result.total / state.pageSize));
      if (state.page > totalPages) {
        state.page = totalPages;
        return loadRequests();
      }
 
      if (result.counts) state.counts = result.counts;
      writeUrlState();
      render(result);
    } catch (error) {
      if (token !== state.token) return;
      console.error("Failed to load staff requests:", error);
      showError(error);
    }
  }
 
  const API_PATH = "/api/staff/repair-requests";
  const API_PAGE_SIZE = 50;
  const API_MAX_PAGES = 100;
 
  async function fetchPage() {
    if (!state.clientRows) {
      state.clientRows = await fetchAllRequests();
    }
    return pageFromRows(state.clientRows);
  }
 
  async function fetchAllRequests() {
    if (typeof apiFetch !== "function") {
      throw new Error("ไม่พบ apiFetch กรุณาตรวจสอบว่าโหลด ../js/api-client.js ก่อน staff-requests.js");
    }
 
    const rows = [];
    for (let page = 0; page < API_MAX_PAGES; page += 1) {
      const query = new URLSearchParams({ page: String(page), size: String(API_PAGE_SIZE) });
 
      let data;
      try {
        data = await apiFetch(`${API_PATH}?${query.toString()}`);
      } catch (error) {
        throw toFriendlyError(error);
      }
 
      const content = data && Array.isArray(data.content) ? data.content : null;
      if (!content) throw new Error("รูปแบบข้อมูลจาก Backend ไม่ถูกต้อง (ไม่พบ content)");
 
      rows.push(...content.map(normalizeRequest));
 
      const totalCount = Number(data.totalCount);
      const reachedTotal = Number.isFinite(totalCount) && rows.length >= totalCount;
      if (reachedTotal || content.length < API_PAGE_SIZE) break;
    }
    return rows;
  }
 
  function toFriendlyError(error) {
    const message = (error && error.message) || "";
    const status = error && (error.status || error.statusCode);
    if (status === 401 || status === 403 || /\b(401|403)\b/.test(message)) {
      return new Error("ไม่มีสิทธิ์เข้าถึงข้อมูล กรุณาเข้าสู่ระบบใหม่ด้วยบัญชีเจ้าหน้าที่");
    }
    if (status === 404 || /\b404\b/.test(message)) {
      return new Error(`ไม่พบ API ${API_PATH} (404) กรุณา git pull develop และรัน docker compose up --build`);
    }
    return error instanceof Error ? error : new Error(message || "เชื่อมต่อ Backend ไม่ได้");
  }
 
  function pageFromRows(rows) {
    const counts = computeCounts(rows);
    const keyword = state.search.toLowerCase();
 
    const filtered = rows
      .filter((r) => state.status === "ALL" || r.status === state.status)
      .filter((r) => !keyword || r.searchText.includes(keyword))
      .sort((a, b) => {

  
  if (a.urgent !== b.urgent) {
    return a.urgent ? -1 : 1;
  }

  return b.createdAtMs - a.createdAtMs;

});
 
    const start = (state.page - 1) * state.pageSize;
    return { items: filtered.slice(start, start + state.pageSize), total: filtered.length, counts };
  }
 
  function firstDefined(...values) {
    return values.find((v) => v !== undefined && v !== null);
  }
 
  function withPrefix(prefix, value) {
    const text = String(value).trim();
    return text.startsWith(prefix) ? text : `${prefix} ${text}`;
  }
 
  function normalizeStatus(value) {
    const key = String(value || "").trim().replace(/[\s-]+/g, "_");
    const upper = key.toUpperCase();
    return STATUS_META[upper] ? upper : STATUS_ALIASES[key] || STATUS_ALIASES[upper] || upper;
  }
 
  function isUrgent(r) {
  if (!r) return false;

  const candidates = [
    r.urgent,
    r.isUrgent,
    r.is_urgent,
    r.urgency,
    r.urgencyLevel,
    r.priority,
    r.reporterUrgent,
    r.confirmedUrgency,
    r.staffUrgency
  ];

  return candidates.some((value) => {
    if (value === true || value === 1) return true;

    if (typeof value === "string") {
      const normalized = value.trim().toUpperCase();

      return [
        "URGENT",
        "HIGH",
        "CRITICAL",
        "TRUE",
        "1",
        "เร่งด่วน",
        "ด่วน"
      ].includes(normalized);
    }

    return false;
  });
}
 
  function buildLocation(r) {
    const building = firstDefined(r.buildingName, r.building);
    const room = firstDefined(r.roomNo, r.room, r.roomNumber);
    const area = firstDefined(r.areaName, r.locationDetail, r.location);
 
    const parts = [];
    if (building) parts.push(withPrefix("อาคาร", building));
    if (room) parts.push(withPrefix("ห้อง", room));
    else if (area) parts.push(String(area));
    return parts.join(" • ");
  }
 
  const CATEGORY_LABELS = {
    ELECTRIC: "ไฟฟ้า", ELECTRICAL: "ไฟฟ้า",
    PLUMBING: "ประปา", WATER: "ประปา",
    AIR_CON: "แอร์", AIRCON: "แอร์", AIR_CONDITIONER: "แอร์",
    FURNITURE: "เฟอร์นิเจอร์", CARPENTRY: "เฟอร์นิเจอร์",
    OTHER: "อื่น ๆ", GENERAL: "ทั่วไป",
  };
 
  function categoryLabel(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return CATEGORY_LABELS[text.toUpperCase().replace(/[\s-]+/g, "_")] || text;
  }
 
  function normalizeRequest(r) {
    const id = firstDefined(r.id, r.requestId, r.request_id);
    const rawCode = String(firstDefined(r.requestNo, r.code, id, "")).trim();
    const code = rawCode.startsWith("#") ? rawCode : `#${rawCode}`;
    const title = String(firstDefined(r.title, r.subject, r.summary, r.detail, "คำร้องแจ้งซ่อม")).trim();
    const requester = String(firstDefined(r.requesterName, r.residentName, r.reporterName, r.createdByName, "")).trim();
    const location = buildLocation(r);
    const category = categoryLabel(firstDefined(r.categoryName, r.category, r.problemType, ""));
    const createdAt = firstDefined(r.createdAt, r.created_at, r.reportedAt, r.submittedAt);
    const createdAtMs = createdAt ? new Date(createdAt).getTime() || 0 : 0;
    const urgentFlag = isUrgent(r);
 
    return {
      id,
      code,
      title,
      requester,
      location,
      category,
      createdAt,
      createdAtMs,
      status: normalizeStatus(firstDefined(r.status, r.statusCode)),
      urgent: urgentFlag,
      hasTechnician: Boolean(firstDefined(r.technicianId, r.assignedTo, r.technicianName, r.technician)),
      searchText: [rawCode, id, title, requester, location, category, r.detail, r.description]
        .filter((v) => v !== undefined && v !== null)
        .join(" ")
        .toLowerCase(),
    };
  }
 
  function computeCounts(rows) {
    const counts = { all: rows.length, pending: 0, inProgress: 0, completed: 0, urgentUnassigned: 0 };
    rows.forEach((r) => {
      if (r.status === "PENDING") counts.pending += 1;
      if (r.status === "IN_PROGRESS") counts.inProgress += 1;
      if (r.status === "COMPLETED") counts.completed += 1;
      if (r.urgent && r.status === "PENDING" && !r.hasTechnician) counts.urgentUnassigned += 1;
    });
    return counts;
  }
 
  function thaiDateParts(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
 
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
 
    const year = Number(parts.year);
    return {
      date: `${Number(parts.day)} ${TH_MONTHS[Number(parts.month) - 1]} ${year < 2400 ? year + 543 : year}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  }
 
  function formatDateTime(value) {
    const p = value ? thaiDateParts(value) : null;
    return p ? `${p.date} ${p.time}` : "-";
  }
 
  function setHidden(el, hidden) {
    if (el) el.classList.toggle("is-hidden", hidden);
  }
 
  function hideAllResults() {
    setHidden(els.error, true);
    setHidden(els.empty, true);
    setHidden(els.tableWrap, true);
    setHidden(els.tableHint, true);
    setHidden(els.list, true);
    setHidden(els.pagination, true);
  }
 
  function showLoading() {
    hideAllResults();
    setHidden(els.loading, false);
    if (els.resultCount) els.resultCount.textContent = "กำลังโหลดรายการคำร้อง";
  }
 
  function showError(error) {
    hideAllResults();
    setHidden(els.loading, true);
    if (els.errorMessage) {
      els.errorMessage.textContent = (error && error.message) ? `ไม่สามารถโหลดรายการคำร้องได้: ${error.message}` : "ไม่สามารถโหลดรายการคำร้องได้";
    }
    setHidden(els.error, false);
    if (els.resultCount) els.resultCount.textContent = "โหลดรายการไม่สำเร็จ";
  }
 
  function render({ items, total }) {
    hideAllResults();
    setHidden(els.loading, true);
    renderSummary();
 
    const totalText = total.toLocaleString("th-TH");
    if (els.resultCount) {
      els.resultCount.textContent = DESKTOP_QUERY.matches
        ? `${totalText} รายการ • หน้าละ ${state.pageSize} รายการ • เร่งด่วนก่อน แล้วเรียงตามวันที่แจ้งล่าสุด`
        : `${totalText} รายการ • เร่งด่วนก่อน แล้วเรียงตามวันที่แจ้งล่าสุด`;
    }
 
    if (items.length === 0) {
      setHidden(els.empty, false);
      return;
    }
 
    renderTable(items);
    renderMobileList(items);
    setHidden(els.tableWrap, false);
    setHidden(els.tableHint, false);
    setHidden(els.list, false);
    renderPagination(total);
  }
 
  function renderSummary() {
    const c = state.counts;
    const set = (el, value) => {
      if (el) el.textContent = value === undefined || value === null ? "–" : Number(value).toLocaleString("th-TH");
    };
 
    set(els.countPending, c && c.pending);
    set(els.countInProgress, c && c.inProgress);
    set(els.countCompleted, c && c.completed);
    set(els.countUrgent, c && c.urgentUnassigned);
 
    const chipValues = {
      ALL: c && c.all,
      PENDING: c && c.pending,
      IN_PROGRESS: c && c.inProgress,
      COMPLETED: c && c.completed,
    };
    els.chips.forEach((chip) => {
      const span = chip.querySelector('[data-field="count"]');
      set(span, chipValues[chip.dataset.status || "ALL"]);
    });
  }
 
  function makeBadge(text, className) {
    const span = document.createElement("span");
    span.className = `badge ${className}`;
    span.textContent = text;
    return span;
  }
 
  function statusBadgeInfo(status) {
    const meta = STATUS_META[status];
    return meta ? meta : { label: status || "-", className: "badge--normal" };
  }
 
  function renderTable(items) {
    if (!els.tableBody) return;
    els.tableBody.replaceChildren();
    const fragment = document.createDocumentFragment();
 
    items.forEach((req) => {
      const row = els.rowTemplate.content.cloneNode(true);
      const href = detailUrl(req);
      const q = (field) => row.querySelector(`[data-field="${field}"]`);
 
      row.querySelector("tr").dataset.href = href;
      q("code").textContent = req.code;
      q("link").href = href;
      q("title").textContent = req.title;
      q("location").textContent = [req.location, req.requester].filter(Boolean).join(" · ") || "-";
      q("category").textContent = req.category || "-";
 
      const urgency = q("urgency");
      urgency.textContent = req.urgent ? "เร่งด่วน" : "ปกติ";
      urgency.className = `badge ${req.urgent ? "badge--urgent" : "badge--normal"}`;
 
      const info = statusBadgeInfo(req.status);
      const status = q("status");
      status.textContent = info.label;
      status.className = `badge ${info.className}`;
 
      q("created-at").textContent = formatDateTime(req.createdAt);
      q("detail-link").href = href;
 
      fragment.appendChild(row);
    });
 
    els.tableBody.appendChild(fragment);
  }
 
  function renderMobileList(items) {
    if (!els.list) return;
    els.list.replaceChildren();
    const fragment = document.createDocumentFragment();
 
    items.forEach((req) => {
      const item = els.itemTemplate.content.cloneNode(true);
      const q = (field) => item.querySelector(`[data-field="${field}"]`);
 
      q("link").href = detailUrl(req);
 
      const info = statusBadgeInfo(req.status);
      const badges = q("badges");
      badges.appendChild(makeBadge(info.label, info.className));
      if (req.urgent) badges.appendChild(makeBadge("เร่งด่วน", "badge--urgent"));
 
      q("title").textContent = req.title;
      q("meta").textContent =
        [req.code, req.location].filter(Boolean).join(" • ") + (req.category ? ` · ${req.category}` : "");
      q("date").textContent = req.createdAt ? `แจ้งเมื่อ ${formatDateTime(req.createdAt)}` : "";
 
      fragment.appendChild(item);
    });
 
    els.list.appendChild(fragment);
  }
 
  function pageNumbers(current, last) {
    const set = new Set([1, last, current - 1, current, current + 1]);
    if (current <= 3) { set.add(2); set.add(3); }
    if (current >= last - 2) { set.add(last - 1); set.add(last - 2); }
 
    const sorted = Array.from(set).filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
    const result = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) result.push("…");
      result.push(p);
    });
    return result;
  }
 
  function renderPagination(total) {
    if (!els.pagination) return;
    const last = Math.max(1, Math.ceil(total / state.pageSize));
    const start = (state.page - 1) * state.pageSize + 1;
    const end = Math.min(state.page * state.pageSize, total);
 
    if (els.info) {
      els.info.textContent = `แสดง ${start.toLocaleString("th-TH")}–${end.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} รายการ`;
    }
    if (els.prev) els.prev.disabled = state.page <= 1;
    if (els.next) els.next.disabled = state.page >= last;
 
    if (els.pageList) {
      els.pageList.replaceChildren();
      pageNumbers(state.page, last).forEach((p) => {
        if (p === "…") {
          const gap = document.createElement("span");
          gap.className = "pagination__ellipsis";
          gap.textContent = "…";
          gap.setAttribute("aria-hidden", "true");
          els.pageList.appendChild(gap);
          return;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pagination__button" + (p === state.page ? " is-active" : "");
        btn.dataset.page = String(p);
        btn.textContent = String(p);
        btn.setAttribute("aria-label", `หน้า ${p}`);
        if (p === state.page) btn.setAttribute("aria-current", "page");
        els.pageList.appendChild(btn);
      });
    }
 
    setHidden(els.pagination, false);
  }
})();