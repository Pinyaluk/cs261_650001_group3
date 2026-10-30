// js/staff-request-detail.js
// หน้ารายละเอียดคำร้อง + มอบหมายช่าง (เจ้าหน้าที่)
// ดึงข้อมูลผ่าน apiFetch (api-client.js) — ไม่มีข้อมูลตัวอย่างในไฟล์นี้
 
window.__staffDetailLoaded = true;
window.__staffDetailStage = "script-loaded";
 
try {
  if (typeof requireRole === "function") requireRole("STAFF");
} catch (error) {
  console.error("requireRole failed:", error);
}
 
(function () {
  "use strict";
 
  /* ========================================
     ⚠️ ตั้งค่า endpoint — ตรวจให้ตรงกับ docs/api-spec-sprint2.md
  ======================================== */
 
  const API = {
    list: "/api/staff/repair-requests",                                  // 2.1
    detail: (id) => `/api/staff/repair-requests/${encodeURIComponent(id)}`, // 2.3
    technicians: (query) => `/api/staff/technicians?${query}`,           // 2.5  ?category=&date=&slot=
    assign: (id) => `/api/staff/repair-requests/${encodeURIComponent(id)}/assign`, // 2.4
    assignMethod: "PUT",
    listPageSize: 50,
    listMaxPages: 100,
  };
 
  // แสดงข้อผิดพลาด JavaScript บนหน้าจอ แทนที่จะค้างที่ "กำลังโหลด"
  window.addEventListener("error", (e) => {
    console.error("Global JS Error:", e);
    showPageError(`JavaScript error: ${e.message}`, false);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    console.error("Unhandled Promise Rejection:", r);
    showPageError(`เกิดข้อผิดพลาด: ${(r && r.message) || r}`, true);
  });
 
  /* ---------- API layer ---------- */
 
  function apiGet(path) {
    if (typeof apiFetch !== "function") {
      return Promise.reject(new Error("ไม่พบ apiFetch — ตรวจว่า ../js/api-client.js โหลดก่อน staff-request-detail.js"));
    }
    console.info("[detail] GET", path);
    return apiFetch(path);
  }
 
  function isAuthError(error) {
    const status = error && (error.status || error.statusCode);
    return status === 401 || status === 403 || /\b(401|403)\b/.test((error && error.message) || "");
  }
 
  async function fetchRequestDetail(id) {
    try {
      const data = await apiGet(API.detail(id));
      if (data && typeof data === "object" && !Array.isArray(data)) {
        console.info("[detail] source = detail endpoint");
        return data;
      }
    } catch (error) {
      if (isAuthError(error)) throw error;
      console.warn("[detail] detail endpoint ใช้ไม่ได้ จะค้นหาจากรายการแทน:", error);
    }
 
    for (let page = 0; page < API.listMaxPages; page += 1) {
      const query = new URLSearchParams({ page: String(page), size: String(API.listPageSize) });
      const data = await apiGet(`${API.list}?${query.toString()}`);
      const content = data && Array.isArray(data.content) ? data.content : [];
      const found = content.find((r) => String(firstDefined(r.requestId, r.id, r.request_id)) === String(id));
      if (found) {
        console.info("[detail] source = list endpoint (page " + page + ")");
        return found;
      }
      const total = Number(data && data.totalCount);
      if (content.length < API.listPageSize || (Number.isFinite(total) && (page + 1) * API.listPageSize >= total)) break;
    }
    throw new Error(`ไม่พบคำร้องเลขที่ ${id} ในฐานข้อมูล`);
  }
 
  /* ========================================
     ค่าคงที่
  ======================================== */
 
  const LIST_PAGE = "staff-requests.html";
 
  const STATUS_META = {
    PENDING: { label: "รอรับเรื่อง", className: "badge--pending" },
    IN_PROGRESS: { label: "กำลังดำเนินการ", className: "badge--in-progress" },
    COMPLETED: { label: "เสร็จสิ้น", className: "badge--completed" },
  };
 
  const PERIODS = {
    MORNING: { short: "ช่วงเช้า", full: "ช่วงเช้า 09:00–12:00 น.", start: "09:00" },
    AFTERNOON: { short: "ช่วงบ่าย", full: "ช่วงบ่าย 13:00–16:00 น.", start: "13:00" },
  };
 
  const CATEGORY_LABELS = {
    ELECTRIC: "ไฟฟ้า", ELECTRICAL: "ไฟฟ้า",
    PLUMBING: "ประปา", WATER: "ประปา",
    AIR_CON: "แอร์", AIRCON: "แอร์", AIR_CONDITIONER: "แอร์",
    FURNITURE: "เฟอร์นิเจอร์", CARPENTRY: "เฟอร์นิเจอร์",
    OTHER: "อื่น ๆ", GENERAL: "ทั่วไป",
  };
 
  const AREA_TYPE_LABELS = {
    ROOM: "ห้องพัก", PRIVATE: "ห้องพัก",
    COMMON: "พื้นที่ส่วนกลาง", COMMON_AREA: "พื้นที่ส่วนกลาง", PUBLIC: "พื้นที่ส่วนกลาง",
  };
 
  const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
 
  const state = {
    id: null,
    req: null,
    urgency: "NORMAL",
    slotChoice: null,
    technicians: [],
    technicianId: null,
    techToken: 0,
    submitting: false,
    returnTo: readReturnParams(),
  };
 
  const $ = (id) => document.getElementById(id);
 
  /* ========================================
     เริ่มทำงาน
  ======================================== */
 
  document.addEventListener("DOMContentLoaded", () => {
    window.__staffDetailStage = "dom-ready";
    state.id = new URLSearchParams(window.location.search).get("id");
    
    const loadingEl = $("detail-loading");
    if (loadingEl) {
      loadingEl.textContent = `กำลังโหลดข้อมูลคำร้อง #${state.id || "?"} ...`;
    }
 
    setupNavigation();
    showUserName();
    bindEvents();
 
    if (!state.id) {
      showPageError("ไม่พบเลขคำร้องใน URL (ต้องมี ?id=...)", false);
      return;
    }
    loadRequest();
  });
 
  function readReturnParams() {
    const p = new URLSearchParams(window.location.search);
    const page = parseInt(p.get("returnPage"), 10);
    const status = (p.get("returnStatus") || "ALL").toUpperCase();
    return {
      status: status === "ALL" || STATUS_META[status] ? status : "ALL",
      page: page > 0 ? page : 1,
      q: (p.get("returnQ") || "").trim(),
    };
  }
 
  function listUrl() {
    const params = new URLSearchParams();
    const r = state.returnTo;
    if (r.status !== "ALL") params.set("status", r.status);
    if (r.q) params.set("q", r.q);
    if (r.page > 1) params.set("page", String(r.page));
    const qs = params.toString();
    return LIST_PAGE + (qs ? `?${qs}` : "");
  }
 
  function setupNavigation() {
    const url = listUrl();
    document.querySelectorAll(".js-list-link").forEach((a) => { a.href = url; });
    const backLabel = $("back-label");
    if (backLabel) {
      const statusLabel = state.returnTo.status === "ALL" ? "ทั้งหมด" : STATUS_META[state.returnTo.status].label;
      backLabel.textContent = `กลับไปรายการคำร้อง · ${statusLabel} หน้า ${state.returnTo.page}`;
    }
  }
 
  function showUserName() {
    let name = "";
    ["getCurrentUser", "getSessionUser", "getUser"].some((fn) => {
      if (typeof window[fn] !== "function") return false;
      try {
        const u = window[fn]();
        name = (u && (u.fullName || u.name || u.displayName)) || "";
      } catch (_) { name = ""; }
      return Boolean(name);
    });
    if (!name) return;
    document.querySelectorAll(".js-user-name").forEach((el) => { el.textContent = name; });
  }
 
  const firstDefined = (...v) => v.find((x) => x !== undefined && x !== null && x !== "");
 
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
 
  function setHidden(node, hidden) {
    if (node) node.classList.toggle("is-hidden", hidden);
  }
 
  function withPrefix(prefix, value) {
    const text = String(value).trim();
    return text.startsWith(prefix) ? text : `${prefix} ${text}`;
  }
 
  function bangkokParts(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok", day: "numeric", month: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    return parts;
  }
 
  function thaiYear(year) {
    return year < 2400 ? year + 543 : year;
  }
 
  function formatDate(value) {
    if (!value) return "-";
    const text = String(value);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (m) return `${Number(m[3])} ${TH_MONTHS[Number(m[2]) - 1]} ${thaiYear(Number(m[1]))}`;
    const p = bangkokParts(value);
    return p ? `${Number(p.day)} ${TH_MONTHS[Number(p.month) - 1]} ${thaiYear(Number(p.year))}` : "-";
  }
 
  function formatDateTimeLong(value) {
    const p = value ? bangkokParts(value) : null;
    if (!p) return "";
    return `${Number(p.day)} ${TH_MONTHS[Number(p.month) - 1]} ${thaiYear(Number(p.year))} เวลา ${p.hour}:${p.minute} น.`;
  }
 
  function todayIso() {
    const p = bangkokParts(new Date());
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  }
 
  function normalizePeriod(value) {
    const t = String(value || "").toUpperCase();
    if (t.includes("MORN") || t.includes("เช้า") || t === "AM") return "MORNING";
    if (t.includes("AFTER") || t.includes("บ่าย") || t === "PM") return "AFTERNOON";
    return "";
  }
 
  function periodLabel(period) {
    return PERIODS[period] ? PERIODS[period].full : "";
  }
 
  function isoDateOnly(value) {
    if (!value) return "";
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const p = bangkokParts(value);
    return p ? `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}` : "";
  }
 
  function categoryLabel(value) {
    if (!value) return "";
    const key = String(value).trim().toUpperCase().replace(/[\s-]+/g, "_");
    return CATEGORY_LABELS[key] || String(value).trim();
  }
 
  function normalizeStatus(value) {
    const key = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (STATUS_META[key]) return key;
    const aliases = { "รอรับเรื่อง": "PENDING", "กำลังดำเนินการ": "IN_PROGRESS", "เสร็จสิ้น": "COMPLETED", OPEN: "PENDING", NEW: "PENDING", ASSIGNED: "IN_PROGRESS", DONE: "COMPLETED" };
    return aliases[key] || aliases[String(value || "").trim()] || key;
  }
 
  function isUrgentValue(v) {
    if (v === true || v === 1) return true;
    return typeof v === "string" && ["URGENT", "HIGH", "TRUE", "เร่งด่วน"].includes(v.trim().toUpperCase());
  }
 
  function normalizeSlots(r) {
    const list = firstDefined(r.preferredSlots, r.appointmentOptions, r.availableSlots, r.slots);
    let slots = [];
    if (Array.isArray(list)) {
      slots = list.map((s) => ({
        date: isoDateOnly(firstDefined(s.date, s.preferredDate, s.appointmentDate)),
        period: normalizePeriod(firstDefined(s.period, s.timeSlot, s.timePeriod)),
      }));
    } else {
      [1, 2].forEach((n) => {
        const date = firstDefined(r[`preferredDate${n}`], r[`slot${n}Date`], r[`preferredDate_${n}`]);
        if (date) {
          slots.push({
            date: isoDateOnly(date),
            period: normalizePeriod(firstDefined(r[`preferredSlot${n}`], r[`preferredPeriod${n}`], r[`slot${n}Period`], r[`preferredTime${n}`])),
          });
        }
      });
    }
    return slots.filter((s) => s.date).slice(0, 2);
  }
 
  function resolveAssetUrl(url) {
    const text = String(url || "");
    if (!text || /^(https?:)?\/\//i.test(text) || text.startsWith("data:")) return text;
    let base = "";
    try { if (typeof API_BASE_URL === "string") base = API_BASE_URL; } catch (_) {}
    if (!base && typeof window.API_BASE_URL === "string") base = window.API_BASE_URL;
    if (!base && typeof window.API_BASE === "string") base = window.API_BASE;
    if (!base) base = `${window.location.protocol}//${window.location.hostname}:8080`;
    return base.replace(/\/$/, "") + (text.startsWith("/") ? text : `/${text}`);
  }
 
  function normalizePhotos(r) {
    const list = firstDefined(r.images, r.photos, r.attachments, r.imageUrls) || [];
    if (!Array.isArray(list)) return [];
    return list
      .map((p) => (typeof p === "string"
        ? { url: resolveAssetUrl(p), caption: "" }
        : { url: resolveAssetUrl(firstDefined(p.url, p.imageUrl, p.path, p.src, "")), caption: firstDefined(p.caption, p.description, p.name, "") }))
      .filter((p) => p.url);
  }
 
  function buildLocation(r) {
    const building = firstDefined(r.building, r.buildingName);
    const floor = firstDefined(r.floor, r.floorNo);
    const room = firstDefined(r.roomNo, r.room, r.roomNumber);
    const detail = firstDefined(r.locationDetail);
    const parts = [];
    if (building) parts.push(withPrefix("อาคาร", building));
    if (floor) parts.push(withPrefix("ชั้น", floor));
    if (room) parts.push(withPrefix("ห้อง", room));
    else if (detail) parts.push(String(detail));
    return parts.join(" • ");
  }
 
  function assignedEntry(r) {
    const list = Array.isArray(r.statusHistory) ? r.statusHistory : [];
    const hit = list.filter((h) => normalizeStatus(h && h.status) === "IN_PROGRESS").pop();
    return hit || {};
  }
 
  function reporterRoomLabel(r, building, room) {
    if (room) return `ห้อง ${building ? `${building}-` : ""}${room}`;
    const detail = String(firstDefined(r.locationDetail, "")).trim();
    if (!detail) return "";
    const m = /^ห้อง\s*(.+)$/.exec(detail);
    if (!m) return detail;
    return `ห้อง ${building ? `${building}-` : ""}${m[1].trim()}`;
  }
 
  function normalizeRequest(raw) {
    const r = (raw && (raw.data || raw.request)) || raw || {};
    
    console.log("🔍 ข้อมูลดิบคำร้องจาก API:", r);

    const id = firstDefined(r.requestId, r.id, r.request_id);
    const room = firstDefined(r.roomNo, r.room, r.roomNumber);
    const building = firstDefined(r.building, r.buildingName);
    const areaKey = String(firstDefined(r.locationType, r.areaType, "")).toUpperCase().replace(/[\s-]+/g, "_");
    const category = firstDefined(r.category, r.categoryName, r.problemType, "");
 
    return {
      id,
      code: `#${firstDefined(r.requestNo, id, "")}`,
      title: String(firstDefined(r.title, r.subject, "คำร้องแจ้งซ่อม")),
      status: normalizeStatus(r.status),
      reporterUrgent: [r.isUrgent, r.urgent, r.urgency, r.urgencyLevel, r.priority].some(isUrgentValue),
      urgencyConfirmed: firstDefined(r.confirmedUrgency, r.staffUrgency),
      areaType: AREA_TYPE_LABELS[areaKey] || firstDefined(r.locationType, r.areaType, "-"),
      location: buildLocation(r) || "-",
      category: categoryLabel(category),
      categoryRaw: String(category),
      equipment: firstDefined(r.equipment, r.equipmentName, r.deviceName, r.itemName, "-"),
      detail: firstDefined(r.description, r.detail, r.details, "-"),
      createdAt: firstDefined(r.createdAt, r.created_at),
      photos: normalizePhotos(r),
      slots: normalizeSlots(r),
      reporterName: String(firstDefined(r.reporterName, r.requesterName, r.residentName, "")),
      reporterRoom: reporterRoomLabel(r, building, room),
      reporterPhone: String(firstDefined(r.reporterPhone, r.phone, "")),
      reporterLine: String(firstDefined(r.reporterLineId, r.reporterLine, r.lineId, "")),
      assigned: {
        technicianName: firstDefined(
          r.technicianName, 
          r.assignedTechnicianName, 
          r.techName,
          r.staffName,
          r.technician && (r.technician.fullName || r.technician.name || r.technician.username),
          r.assignedTechnician && (r.assignedTechnician.fullName || r.assignedTechnician.name || r.assignedTechnician.username),
          r.staff && (r.staff.fullName || r.staff.name)
        ),
        technicianPhone: firstDefined(
          r.technicianPhone, 
          r.technician && r.technician.phone,
          r.assignedTechnician && r.assignedTechnician.phone,
          r.staff && r.staff.phone
        ),
        date: firstDefined(r.appointmentDate, r.scheduledDate),
        period: normalizePeriod(firstDefined(r.appointmentSlot, r.appointmentPeriod, r.scheduledPeriod)),
        note: firstDefined(r.appointmentNote, ""),
        assignedBy: firstDefined(r.assignedByName, r.confirmedByName, assignedEntry(r).changedByName),
        assignedAt: firstDefined(r.assignedAt, r.confirmedAt, assignedEntry(r).changedAt),
      },
    };
  }
 
  async function loadRequest() {
    console.info("[detail] เริ่มโหลดคำร้อง ID:", state.id);
    setHidden($("detail-error"), true);
    setHidden($("detail-content"), true);
    setHidden($("success-view"), true);
    setHidden($("back-link"), false);
    setHidden($("detail-loading"), false);
 
    try {
      window.__staffDetailStage = "กำลังเรียก API";
      const data = await fetchRequestDetail(state.id);
      window.__staffDetailStage = "ได้ข้อมูลแล้ว กำลังแสดงผล";
      console.info("[detail] ได้ข้อมูลคำร้อง:", data);
 
      state.req = normalizeRequest(data);
      renderRequest();
      setHidden($("detail-loading"), true);
      setHidden($("detail-content"), false);
 
      if (state.req.status === "PENDING") {
        initForm();
        loadTechnicians();
      } else {
        showReadOnly();
      }
    } catch (error) {
      console.error("Failed to load request detail:", error);
      showPageError(friendlyMessage(error, "โหลดข้อมูลคำร้องไม่สำเร็จ"), true);
    }
  }
 
  function friendlyMessage(error, fallback) {
    const msg = (error && error.message) || "";
    const status = error && (error.status || error.statusCode);
    if (status === 401 || status === 403 || /\b(401|403)\b/.test(msg)) return "ไม่มีสิทธิ์เข้าถึงข้อมูล กรุณาเข้าสู่ระบบใหม่ด้วยบัญชีเจ้าหน้าที่";
    if (status === 404 || /\b404\b/.test(msg)) return "ไม่พบข้อมูล (404) กรุณาตรวจสอบเลขคำร้องและ endpoint ของ API";
    return msg || fallback;
  }
 
  function showPageError(message, canRetry) {
    setHidden($("detail-loading"), true);
    setHidden($("detail-content"), true);
    const errMsg = $("detail-error-message");
    if (errMsg) errMsg.textContent = message;
    setHidden($("detail-retry"), !canRetry);
    setHidden($("detail-error"), false);
  }
 
  function statusBadge(status) {
    const meta = STATUS_META[status] || { label: status || "-", className: "badge--normal" };
    return el("span", `badge ${meta.className}`, meta.label);
  }
 
  function renderRequest() {
    const r = state.req;
    document.title = `คำร้อง ${r.code} | เจ้าหน้าที่หอพัก`;
    if ($("page-title")) $("page-title").textContent = `คำร้อง ${r.code}`;
 
    const badges = $("info-badges");
    if (badges) {
      badges.replaceChildren(statusBadge(r.status));
      if (r.reporterUrgent) badges.appendChild(el("span", "badge badge--urgent", "เร่งด่วน (ผู้แจ้งระบุ)"));
    }
 
    if ($("req-title")) $("req-title").textContent = r.title;
    const created = formatDateTimeLong(r.createdAt);
    if ($("req-meta")) {
      $("req-meta").textContent = [r.code, created && `แจ้งเมื่อ ${created}`, r.reporterName && `โดย ${r.reporterName}`]
        .filter(Boolean).join(" • ");
    }
 
    if ($("fact-area-type")) $("fact-area-type").textContent = r.areaType;
    if ($("fact-location")) $("fact-location").textContent = r.location;
    if ($("fact-category")) $("fact-category").textContent = r.category || "-";
    if ($("fact-equipment")) $("fact-equipment").textContent = r.equipment;
    if ($("fact-detail")) $("fact-detail").textContent = r.detail;
 
    if ($("fact-location-m")) $("fact-location-m").textContent = r.areaType && r.areaType !== "-" ? `${r.location} (${r.areaType})` : r.location;
    if ($("fact-problem-m")) $("fact-problem-m").textContent = [r.category, r.equipment !== "-" ? r.equipment : ""].filter(Boolean).join(" • ") || "-";
    if ($("fact-detail-m")) $("fact-detail-m").textContent = r.detail;
 
    renderPhotos();
    renderPreferredSlots();
    renderContact();
  }
 
  function renderPhotos() {
    const photos = state.req.photos;
    setHidden($("photos-section"), photos.length === 0);
    if (!photos.length) return;
 
    if ($("photos-title")) $("photos-title").textContent = `รูปภาพประกอบจากผู้แจ้ง (${photos.length} รูป)`;
    const grid = $("photo-grid");
    if (!grid) return;
    grid.replaceChildren();
 
    photos.forEach((photo, i) => {
      const li = el("li");
      const frame = el("button", "photo-grid__frame");
      frame.type = "button";
      frame.setAttribute("aria-label", `เปิดรูปที่ ${i + 1} ในแท็บใหม่`);
 
      const img = document.createElement("img");
      img.alt = photo.caption || `รูปประกอบที่ ${i + 1}`;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        img.remove();
        frame.textContent = "โหลดรูปไม่สำเร็จ";
      });
      img.src = photo.url;
      frame.appendChild(img);
      frame.addEventListener("click", () => window.open(photo.url, "_blank", "noopener"));
 
      li.appendChild(frame);
      if (photo.caption) li.appendChild(el("p", "photo-grid__caption", photo.caption));
      grid.appendChild(li);
    });
  }
 
  function slotText(slot) {
    return `${formatDate(slot.date)}\n${periodLabel(slot.period) || "ไม่ระบุช่วงเวลา"}`;
  }
 
  function renderPreferredSlots() {
    const box = $("preferred-slots");
    if (!box) return;
    box.replaceChildren();
    const slots = state.req.slots;
    if (!slots.length) {
      const wrap = el("div", "detail-facts__wide");
      wrap.appendChild(el("dd", "", "ผู้แจ้งไม่ได้ระบุช่วงเวลา"));
      box.appendChild(wrap);
      return;
    }
    slots.forEach((slot, i) => {
      const wrap = el("div");
      wrap.appendChild(el("dt", "", `ช่วงที่ ${i + 1}`));
      wrap.appendChild(el("dd", "", slotText(slot)));
      box.appendChild(wrap);
    });
  }
 
  function renderContact() {
    const r = state.req;
    if ($("contact-name")) $("contact-name").textContent = [r.reporterName, r.reporterRoom].filter(Boolean).join(" • ") || "-";
    if ($("contact-phone")) $("contact-phone").textContent = r.reporterPhone || "-";
    setHidden($("contact-line-wrap"), !r.reporterLine);
    if ($("contact-line")) $("contact-line").textContent = r.reporterLine || "-";
 
    const call = $("call-btn");
    if (call) {
      if (r.reporterPhone) {
        call.href = `tel:${r.reporterPhone.replace(/[^\d+]/g, "")}`;
        call.removeAttribute("aria-disabled");
        if ($("call-label")) $("call-label").textContent = `โทร ${r.reporterPhone}`;
      } else {
        call.removeAttribute("href");
        call.setAttribute("aria-disabled", "true");
        if ($("call-label")) $("call-label").textContent = "ไม่มีเบอร์โทรศัพท์";
      }
    }
  }
 
  function choiceCard({ name, value, title, desc, checked, disabled, tag, tagClass }) {
    const label = el("label", "choice" + (checked ? " is-selected" : "") + (disabled ? " is-disabled" : ""));
    const input = document.createElement("input");
    input.type = "radio";
    input.className = "choice__input";
    input.name = name;
    input.value = value;
    input.checked = Boolean(checked);
    input.disabled = Boolean(disabled);
 
    const body = el("span", "choice__body");
    body.appendChild(el("span", "choice__title", title));
    if (desc) body.appendChild(el("span", "choice__desc", desc));
 
    label.append(input, body);
    if (tag) {
      const tagEl = el("span", `choice__tag ${tagClass || ""}`);
      if (typeof tag === "object") {
        tagEl.append(el("span", "only-desktop", tag.long), el("span", "only-mobile", tag.short));
      } else {
        tagEl.textContent = tag;
      }
      label.appendChild(tagEl);
    }
    return label;
  }
 
  function markSelected(container, name) {
    if (!container) return;
    container.querySelectorAll(".choice").forEach((c) => {
      const input = c.querySelector(`input[name="${name}"]`);
      c.classList.toggle("is-selected", Boolean(input && input.checked));
    });
  }
 
  function initForm() {
    const r = state.req;
    setHidden($("assign-form"), false);
    setHidden($("assigned-card"), true);
    setHidden($("readonly-banner"), true);
 
    state.urgency = r.reporterUrgent ? "URGENT" : "NORMAL";
    if ($("urgency-hint")) {
      $("urgency-hint").textContent = r.reporterUrgent
        ? "ผู้แจ้งระบุว่าเร่งด่วน • ยืนยันหรือเปลี่ยนได้"
        : "ผู้แจ้งไม่ได้ระบุว่าเร่งด่วน • ยืนยันหรือเปลี่ยนได้";
    }
    const urgencyBox = $("urgency-options");
    if (urgencyBox) {
      urgencyBox.replaceChildren(
        choiceCard({ name: "urgency", value: "NORMAL", title: "ปกติ", desc: "ซ่อมตามคิวปกติ", checked: state.urgency === "NORMAL" }),
        choiceCard({ name: "urgency", value: "URGENT", title: "เร่งด่วน", desc: "ขึ้นเป็นลำดับแรกในรายการของช่าง", checked: state.urgency === "URGENT" })
      );
    }
 
    const slotBox = $("slot-options");
    if (slotBox) {
      slotBox.replaceChildren();
      r.slots.forEach((slot, i) => {
        slotBox.appendChild(choiceCard({
          name: "slot", value: `SLOT_${i + 1}`,
          title: `ช่วงที่ ${i + 1} · ${formatDate(slot.date)}`,
          desc: `${periodLabel(slot.period) || "ไม่ระบุช่วงเวลา"}ผู้แจ้งเสนอ`,
          checked: i === 0,
        }));
      });
      state.slotChoice = r.slots.length ? "SLOT_1" : "CUSTOM";
      slotBox.appendChild(choiceCard({
        name: "slot", value: "CUSTOM", title: "กำหนดวันนัดใหม่",
        desc: "ใช้เมื่อไม่สะดวกทั้ง 2 ช่วง • โทรตกลงกับผู้แจ้งก่อน",
        checked: state.slotChoice === "CUSTOM",
      }));
    }
    if ($("custom-date")) $("custom-date").min = todayIso();
    toggleCustom();
 
    const label = r.category || "ช่าง";
    if ($("tech-title")) $("tech-title").textContent = `3. เลือกช่าง${r.category || ""}`.trim();
    if ($("tech-hint")) $("tech-hint").textContent = `แสดงเฉพาะช่างประเภท${label}`;
  }
 
  function toggleCustom() {
    const custom = state.slotChoice === "CUSTOM";
    setHidden($("custom-appt"), !custom);
  }
 
  function currentAppointment() {
    const r = state.req;
    if (state.slotChoice === "CUSTOM") {
      const date = $("custom-date") ? $("custom-date").value : "";
      const period = $("custom-period") ? $("custom-period").value : "";
      return date ? { date, period, source: "CUSTOM" } : null;
    }
    const idx = state.slotChoice === "SLOT_2" ? 1 : 0;
    const slot = r.slots[idx];
    return slot ? { date: slot.date, period: slot.period, source: state.slotChoice } : null;
  }
 
  function normalizeTechnician(t) {
    const appts = firstDefined(t.appointments, t.busyJobs, t.jobs, t.schedule);
    const list = Array.isArray(appts) ? appts : [];
    const count = Number(firstDefined(t.appointmentCount, t.jobCount, t.busyCount, list.length, 0)) || 0;
    return {
      id: firstDefined(t.technicianId, t.id, t.userId),
      name: String(firstDefined(t.fullName, t.name, t.technicianName, "ช่าง")),
      phone: String(firstDefined(t.phone, t.phoneNumber, "")),
      specialty: categoryLabel(firstDefined(t.category, t.specialty, t.skill, state.req && state.req.categoryRaw, "")),
      count,
      first: list[0] || null,
    };
  }
 
  function technicianQuery() {
    const q = new URLSearchParams();
    if (state.req && state.req.categoryRaw) q.set("category", state.req.categoryRaw);
    const appt = currentAppointment();
    if (appt && appt.date && appt.period) {
      q.set("date", appt.date);
      q.set("slot", appt.period);
    }
    return q.toString();
  }
 
  async function loadTechnicians() {
    const token = ++state.techToken;
    setHidden($("tech-loading"), false);
    setHidden($("tech-error"), true);
    setHidden($("tech-empty"), true);
    const techList = $("technician-list");
    if (techList) techList.replaceChildren();
    updateTechHint();
 
    try {
      const techPath = API.technicians(technicianQuery());
      const data = await apiGet(techPath);
      if (token !== state.techToken) return;
 
      const items = Array.isArray(data) ? data : (data && (data.content || data.items || data.technicians || data.data)) || [];
      state.technicians = items.map(normalizeTechnician);
 
      if (!state.technicians.some((t) => String(t.id) === String(state.technicianId))) state.technicianId = null;
 
      setHidden($("tech-loading"), true);
      renderTechnicians();
    } catch (error) {
      if (token !== state.techToken) return;
      console.error("Failed to load technicians:", error);
      setHidden($("tech-loading"), true);
      const errMsg = $("tech-error-message");
      if (errMsg) errMsg.textContent = `${friendlyMessage(error, "โหลดรายชื่อช่างไม่สำเร็จ")} [GET ${API.technicians("...")}]`;
      setHidden($("tech-error"), false);
    }
  }
 
  function updateTechHint() {
    const appt = currentAppointment();
    const label = (state.req && state.req.category) || "ช่าง";
    const hint = $("tech-hint");
    if (!hint) return;
    hint.replaceChildren();
 
    hint.appendChild(el("span", "only-desktop", `แสดงเฉพาะช่างประเภท${label}`));
    if (!appt) {
      hint.appendChild(document.createTextNode("เลือกวันนัดเพื่อดูสถานะคิดของช่าง"));
      return;
    }
    hint.appendChild(document.createTextNode("สถานะคิดจากนัด"));
    hint.appendChild(el("span", "only-desktop", "วันที่"));
    hint.appendChild(document.createTextNode(` ${formatDate(appt.date)} ${(PERIODS[appt.period] || {}).short || ""}`.trimEnd()));
  }
 
  function renderTechnicians() {
    const box = $("technician-list");
    if (!box) return;
    box.replaceChildren();
    setHidden($("tech-empty"), state.technicians.length > 0);
 
    state.technicians.forEach((t) => {
      const busy = t.count > 0;
      let desc = [t.specialty && `ช่าง${t.specialty}`, t.phone].filter(Boolean).join(" • ");
      if (busy && t.first) {
        const f = t.first;
        const when = firstDefined(f.time, f.startTime, (PERIODS[normalizePeriod(f.period)] || {}).start, "");
        const where = firstDefined(f.location, f.locationDetail, "");
        desc = [f.requestId ? `มีนัด #${f.requestId}` : "มีนัด", when && `${when} น.`, where].filter(Boolean).join(" • ");
      }
      box.appendChild(choiceCard({
        name: "technician", value: String(t.id), title: t.name, desc,
        checked: String(t.id) === String(state.technicianId),
        tag: busy ? { long: `มีนัดแล้ว ${t.count} งาน`, short: `มีนัด ${t.count} งาน` } : "ว่าง",
        tagClass: busy ? "choice__tag--busy" : "choice__tag--free",
      }));
    });
  }
 
  function bindEvents() {
    document.querySelectorAll(".js-logout").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof logoutStaff === "function") logoutStaff();
        else if (typeof logout === "function") logout();
      });
    });
 
    if ($("detail-retry")) $("detail-retry").addEventListener("click", loadRequest);
    if ($("tech-retry")) $("tech-retry").addEventListener("click", loadTechnicians);
    if ($("view-detail-btn")) $("view-detail-btn").addEventListener("click", loadRequest);
 
    const urgencyOpts = $("urgency-options");
    if (urgencyOpts) {
      urgencyOpts.addEventListener("change", (e) => {
        if (e.target.name !== "urgency") return;
        state.urgency = e.target.value;
        markSelected($("urgency-options"), "urgency");
      });
    }
 
    const slotOpts = $("slot-options");
    if (slotOpts) {
      slotOpts.addEventListener("change", (e) => {
        if (e.target.name !== "slot") return;
        state.slotChoice = e.target.value;
        markSelected($("slot-options"), "slot");
        toggleCustom();
        clearFieldError("custom-date");
        clearFieldError("custom-note");
        loadTechnicians();
      });
    }
 
    let timer = null;
    const reloadTechSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const customDate = $("custom-date");
        if (state.slotChoice === "CUSTOM" && customDate && customDate.value) loadTechnicians();
      }, 300);
    };
    
    if ($("custom-date")) $("custom-date").addEventListener("change", () => { clearFieldError("custom-date"); reloadTechSoon(); });
    if ($("custom-period")) $("custom-period").addEventListener("change", reloadTechSoon);
    if ($("custom-note")) $("custom-note").addEventListener("input", () => clearFieldError("custom-note"));
 
    const techList = $("technician-list");
    if (techList) {
      techList.addEventListener("change", (e) => {
        if (e.target.name !== "technician") return;
        state.technicianId = e.target.value;
        markSelected($("technician-list"), "technician");
        setFieldMessage("tech-select-error", "");
      });
    }
 
    const assignForm = $("assign-form");
    if (assignForm) {
      assignForm.addEventListener("submit", (e) => {
        e.preventDefault();
        submitAssignment();
      });
    }
  }
 
  function setFieldMessage(id, message) {
    const node = $(id);
    if (!node) return;
    node.textContent = message;
    setHidden(node, !message);
  }
 
  function clearFieldError(inputId) {
    const input = $(inputId);
    if (input) input.classList.remove("is-invalid");
    setFieldMessage(`${inputId}-error`, "");
  }

  function showReadOnly() {
    setHidden($("assign-form"), true);
    setHidden($("assigned-card"), false);
    setHidden($("readonly-banner"), false);
    const r = state.req.assigned;
    
    console.log("🛠️ ข้อมูลช่างที่นำมาแสดงผลใน ReadOnly:", r);

    const assignedFacts = $("assigned-facts");
    if (assignedFacts) {
      assignedFacts.replaceChildren();

      const wrapName = el("div");
      wrapName.appendChild(el("dt", "", "ช่างผู้รับผิดชอบ"));
      wrapName.appendChild(el("dd", "", r.technicianName || "ไม่ระบุชื่อช่าง"));
      assignedFacts.appendChild(wrapName);

      if (r.technicianPhone) {
        const wrapPhone = el("div");
        wrapPhone.appendChild(el("dt", "", "เบอร์โทรศัพท์ช่าง"));
        wrapPhone.appendChild(el("dd", "", r.technicianPhone));
        assignedFacts.appendChild(wrapPhone);
      }

      if (r.date) {
        const wrapDate = el("div");
        wrapDate.appendChild(el("dt", "", "วันนัดหมาย"));
        wrapDate.appendChild(el("dd", "", `${formatDate(r.date)} ${periodLabel(r.period)}`.trim()));
        assignedFacts.appendChild(wrapDate);
      }

      if (r.note) {
        const wrapNote = el("div");
        wrapNote.appendChild(el("dt", "", "หมายเหตุการนัดหมาย"));
        wrapNote.appendChild(el("dd", "", r.note));
        assignedFacts.appendChild(wrapNote);
      }

      const metaText = [r.assignedBy && `โดย ${r.assignedBy}`, r.assignedAt && `เมื่อ ${formatDateTimeLong(r.assignedAt)}`].filter(Boolean).join(" • ");
      if (metaText) {
        const wrapMeta = el("div");
        wrapMeta.appendChild(el("dt", "", "ข้อมูลการมอบหมาย"));
        wrapMeta.appendChild(el("dd", "", metaText));
        assignedFacts.appendChild(wrapMeta);
      }
    }
  }

  async function submitAssignment() {
    if (!state.technicianId) {
      setFieldMessage("tech-select-error", "กรุณาเลือกช่างผู้รับผิดชอบ");
      return;
    }
    const appt = currentAppointment();
    if (!appt || !appt.date || !appt.period) {
      alert("กรุณาระบุวันและช่วงเวลานัดหมายให้ครบถ้วน");
      return;
    }

    setHidden($("assign-submit-error"), true);
    const submitBtn = $("assign-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "กำลังบันทึก...";
    }

    try {
      const payload = {
        technicianId: state.technicianId,
        urgency: state.urgency,
        appointmentDate: appt.date,
        appointmentSlot: appt.period,
        note: $("custom-note") ? $("custom-note").value : "",
      };

      if (typeof apiFetch === "function") {
        await apiFetch(API.assign(state.id), {
          method: API.assignMethod || "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        throw new Error("ไม่พบฟังก์ชัน apiFetch สำหรับส่งข้อมูล");
      }

      setHidden($("assign-form"), true);
      setHidden($("success-view"), false);
      setHidden($("back-link"), true);
    } catch (error) {
      console.error("Failed to assign technician:", error);
      const errMsg = $("assign-submit-error-msg");
      if (errMsg) errMsg.textContent = friendlyMessage(error, "บันทึกการมอบหมายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setHidden($("assign-submit-error"), false);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "ยืนยันการมอบหมายงาน";
      }
    }
  }

})();