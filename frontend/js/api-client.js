// js/api-client.js
// ตอนนี้ใช้ข้อมูลปลอม (mock) พอ backend เสร็จค่อยแก้ไฟล์นี้ไฟล์เดียว

async function login(username, password) {
  if (username && password) {
    return { success: true, name: "คุณสมชาย", room: "A-305" };
  }
  return { success: false };
}

async function getMyRequests() {
  return [
    { id: 1019, title: "ก๊อกน้ำรั่ว", status: "PENDING", category: "ประปา", createdAt: "2026-10-10" },
    { id: 1020, title: "ไฟห้องน้ำดับ", status: "IN_PROGRESS", category: "ไฟฟ้า", createdAt: "2026-10-11" }
  ];
}

async function getRequestById(id) {
  return {
    id: id,
    title: "ก๊อกน้ำรั่ว",
    status: "PENDING",
    category: "ประปา",
    createdAt: "2026-10-10"
  };
}

async function submitRequest(data) {
  return { id: 1024, status: "PENDING" };
}