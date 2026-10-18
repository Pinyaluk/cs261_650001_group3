// js/api-client.js
// ฟังก์ชันเรียก backend จริง (Spring Boot ที่ localhost:8080)
// ทุกหน้าใส่ <script src="../js/api-client.js"></script> ก่อน common.js และ js ของหน้านั้น

const API_BASE = "http://localhost:8080";

/** error จาก API: ใช้ err.status ดูรหัส (400, 401, 404) และ err.message แสดงให้ผู้ใช้ */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  return localStorage.getItem("token");
}

/** หน้าที่ต้อง login ก่อน ให้เรียกบรรทัดแรก: requireLogin(); */
function requireLogin() {
  if (!getToken()) {
    window.location.replace("login.html");
  }
}

/** แปลง path รูปจาก API (/uploads/1019-1.jpg) เป็น URL เต็มสำหรับ <img src> */
function imageUrl(path) {
  return API_BASE + path;
}

/**
 * ตัวกลางเรียก API ทุกตัว
 * - แนบ Authorization: Bearer <token> ให้อัตโนมัติ
 * - ได้ 401 (token หมดอายุ / ยังไม่ login) → ล้างข้อมูลแล้วพาไปหน้า login
 * - ได้ error อื่น → throw ApiError พร้อมข้อความจาก backend
 */
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) {
    headers.Authorization = "Bearer " + token;
  }
  // FormData (ส่งรูป) ห้ามตั้ง Content-Type เอง เบราว์เซอร์จะใส่ boundary ให้
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let res;
  try {
    res = await fetch(API_BASE + path, { ...options, headers });
  } catch (e) {
    throw new ApiError(0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
  }

  if (res.status === 401 && path !== "/api/auth/login") {
    localStorage.clear();
    window.location.replace("login.html");
    throw new ApiError(401, "กรุณาเข้าสู่ระบบใหม่");
  }

  if (!res.ok) {
    let message = "เกิดข้อผิดพลาด (" + res.status + ")";
    try {
      const body = await res.json();
      if (body.message) message = body.message;
    } catch (e) { /* body ไม่ใช่ JSON */ }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ---------- U2 Login / Logout ----------

/**
 * สำเร็จ → { success: true, userId, fullName, role, roomNumber } และเก็บ token ไว้แล้ว
 * ไม่สำเร็จ → { success: false, message }
 */
async function login(username, password) {
  try {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("userId", data.userId);
    localStorage.setItem("fullName", data.fullName);
    localStorage.setItem("role", data.role);
    localStorage.setItem("roomNumber", data.roomNumber || "");
    return { success: true, ...data };
  } catch (err) {
    const message = err.status === 401 ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" : err.message;
    return { success: false, message };
  }
}

async function logout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (e) { /* ออกจากระบบฝั่งหน้าเว็บต่อได้แม้ backend ตอบ error */ }
  localStorage.clear();
  window.location.replace("login.html");
}

// ---------- U3 ประวัติและสถานะ ----------

/** รายการคำร้องของผู้ใช้ เรียงใหม่ไปเก่า ได้ [] ถ้ายังไม่มี
 *  แต่ละรายการ: { requestId, title, category, status, technicianName, createdAt, updatedAt } */
async function getMyRequests() {
  return apiFetch("/api/repair-requests/my");
}

/** รายละเอียดคำร้อง ได้ null ถ้าไม่พบหรือไม่ใช่ของผู้ใช้ (404) */
async function getRequestById(id) {
  try {
    return await apiFetch("/api/repair-requests/" + encodeURIComponent(id));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// ---------- U1 ส่งคำร้อง ----------

/**
 * formData: FormData ที่มี locationType, building, locationDetail, category, title, description,
 *           preferredDate1, preferredSlot1, (preferredDate2, preferredSlot2), contactPhone, lineId, urgency
 *           และ images (append ทีละรูปด้วยชื่อ "images")
 * สำเร็จ → ได้รายละเอียดคำร้องที่สร้าง (มี requestId)
 * ข้อมูลไม่ถูกต้อง → throw ApiError status 400 พร้อม message ภาษาไทย
 */
async function submitRequest(formData) {
  return apiFetch("/api/repair-requests", { method: "POST", body: formData });
}
