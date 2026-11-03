// js/technician-api.js
// U7 / Task49: ฟังก์ชันเรียก API ของหน้าช่าง (โหลดต่อจาก api-client.js)

async function getTechnicianAssignedJobs() {
  return apiFetch("/api/technician/repair-requests/assigned");
}

async function getTechnicianCompletedJobs({ page = 0, size = 10, keyword = "" } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (keyword.trim()) params.set("keyword", keyword.trim());
  return apiFetch("/api/technician/repair-requests/completed?" + params.toString());
}

async function getTechnicianJobDetail(id) {
  return apiFetch("/api/staff/repair-requests/" + encodeURIComponent(id));
}
