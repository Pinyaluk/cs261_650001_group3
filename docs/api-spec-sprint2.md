# API Specification - Sprint 2 (U4 - U8)
## 1. Resident APIs (ผู้พักอาศัย)

### 1.1 Get Resident Repair Request Detail
- Endpoint: GET /api/repair-requests/{requestId}
- Role: RESIDENT
- Description: ใช้ Endpoint เดิมของ Sprint 1 โดยเพิ่มฟิลด์ appointmentNote ใน Response เดิม (ส่งเฉพาะรูปที่ผู้แจ้งแนบ imageUrls โดยผลการซ่อมจะแสดงผ่าน statusHistory ไม่ส่งรูปหลังซ่อมให้ Resident)

Response (200 OK)
{
  "requestId": 1021,
  "title": "ท่อน้ำอุดตันในห้องน้ำ",
  "category": "PLUMBING",
  "locationType": "ROOM",
  "building": "A2",
  "locationDetail": "ห้อง 405",
  "description": "ท่อน้ำในห้องน้ำไหลช้าและมีน้ำขัง",
  "urgency": "NORMAL",
  "status": "IN_PROGRESS",
  "appointmentDate": "2026-11-30",
  "appointmentSlot": "AFTERNOON",
  "appointmentNote": "ช่างจะเข้ามาช่วง 13:30 น.",
  "imageUrls": [
    "/uploads/1021-1.jpg"
  ],
  "statusHistory": [
    {
      "status": "PENDING",
      "note": "ส่งคำร้องแจ้งซ่อมเรียบร้อย",
      "changedByName": "สมชาย ใจดี",
      "changedAt": "2026-10-18T10:00:00"
    },
    {
      "status": "IN_PROGRESS",
      "note": "เจ้าหน้าที่รับเรื่องและนัดหมายช่างแล้ว",
      "changedByName": "เจ้าหน้าที่สมศรี",
      "changedAt": "2026-10-18T12:00:00"
    }
  ],
  "createdAt": "2026-10-18T10:00:00"
}

## 2. Staff & Technician APIs (เจ้าหน้าที่และช่าง)

### 2.1 Get All Repair Requests (Staff) - Paginated
- Endpoint: GET /api/staff/repair-requests
- Role: STAFF
- Query Parameters:
  - page (optional, เริ่มที่ 0, default: 0)
  - size (optional, default: 10)
  - status (optional: PENDING / IN_PROGRESS / COMPLETED)
- Description: ดึงรายการคำร้องทั้งหมดสำหรับเจ้าหน้าที่แบบแบ่งหน้า พร้อมแสดงข้อมูลสถานที่และผู้แจ้งตาม UI ใน Figma

Response (200 OK)
{
  "content": [
    {
      "requestId": 1021,
      "title": "ท่อน้ำอุดตันในห้องน้ำ",
      "category": "PLUMBING",
      "locationType": "ROOM",
      "building": "A2",
      "locationDetail": "ห้อง 405",
      "reporterName": "สมชาย ใจดี",
      "reporterPhone": "081-234-5678",
      "status": "IN_PROGRESS",
      "urgency": "NORMAL",
      "createdAt": "2026-10-18T10:00:00"
    }
  ],
  "page": 0,
  "size": 10,
  "totalCount": 1021,
  "totalPages": 103
}

### 2.2 Get Technician's Assigned Tasks (Groupable by Date)
- Endpoint: GET /api/technician/repair-requests/assigned
- Role: TECHNICIAN
- Description: ดึงงานที่ได้รับมอบหมายของช่างที่ล็อกอินอยู่ เพื่อนำไปจัดกลุ่มบนหน้าเว็บ (วันนี้ / พรุ่งนี้ / ถัดไป) เรียงตามวันนัด และให้งานเร่งด่วนขึ้นก่อน พร้อมแสดง title, building, locationDetail, ชื่อและเบอร์ผู้แจ้ง

Response (200 OK)
[
  {
    "requestId": 1021,
    "title": "ท่อน้ำอุดตันในห้องน้ำ",
    "category": "PLUMBING",
    "locationType": "ROOM",
    "building": "A2",
    "locationDetail": "ห้อง 405",
    "reporterName": "สมชาย ใจดี",
    "reporterPhone": "081-234-5678",
    "urgency": "URGENT",
    "appointmentDate": "2026-10-24",
    "appointmentSlot": "MORNING",
    "appointmentNote": "ท่อแตกเร่งด่วน"
  }
]

### 2.3 Get Staff Repair Request Detail / Completed Job Detail
- Endpoint: GET /api/staff/repair-requests/{requestId}
- Role: STAFF, TECHNICIAN
- Description: รายละเอียดคำร้องสำหรับเจ้าหน้าที่ และรายละเอียดงานที่ทำเสร็จแล้วสำหรับช่าง โดยแยก repairResult และ completedAt ออกจาก appointmentNote ชัดเจน พร้อมฟิลด์ครบถ้วนตาม Sprint 1 และ DB

Response (200 OK)
{
  "requestId": 1021,
  "title": "ท่อน้ำอุดตันในห้องน้ำ",
  "category": "PLUMBING",
  "locationType": "ROOM",
  "building": "A2",
  "locationDetail": "ห้อง 405",
  "reporterName": "สมชาย ใจดี",
  "reporterPhone": "081-234-5678",
  "description": "ท่อน้ำอุดตันในห้องน้ำ ไหลไม่สะดวก",
  "urgency": "NORMAL",
  "status": "COMPLETED",
  "technician": {
    "id": 5,
    "fullName": "ช่างวิชัย สายลม",
    "phone": "089-555-0148"
  },
  "appointmentDate": "2026-11-30",
  "appointmentSlot": "AFTERNOON",
  "appointmentNote": "ช่างจะเข้ามาช่วง 13:30 น.",
  "repairResult": "ทำการเปลี่ยนท่อน้ำทิ้งและงูเหล็กทะลวงสิ่งอุดตันเรียบร้อยแล้ว",
  "completedAt": "2026-11-30T14:30:00",
  "imageUrls": [
    "/uploads/1021-1.jpg"
  ],
  "afterImageUrls": [
    "/uploads/1021-after-1.jpg"
  ],
  "statusHistory": [
    {
      "status": "PENDING",
      "note": "ส่งคำร้องแจ้งซ่อมเรียบร้อย",
      "changedByName": "สมชาย ใจดี",
      "changedAt": "2026-10-18T10:00:00"
    },
    {
      "status": "IN_PROGRESS",
      "note": "เจ้าหน้าที่มอบหมายงานให้ช่างวิชัย",
      "changedByName": "เจ้าหน้าที่สมศรี",
      "changedAt": "2026-10-18T11:00:00"
    },
    {
      "status": "COMPLETED",
      "note": "ช่างดำเนินการซ่อมเสร็จสิ้น",
      "changedByName": "ช่างวิชัย สายลม",
      "changedAt": "2026-11-30T14:30:00"
    }
  ],
  "createdAt": "2026-10-18T10:00:00"
}

### 2.4 Assign Technician, Urgency, and Appointment (Single API)
- Endpoint: PUT /api/staff/repair-requests/{requestId}/assign
- Role: STAFF
- Description: เจ้าหน้าที่มอบหมายช่าง กำหนดความเร่งด่วน และระบุวันนัดหมายใน API เดียว 
- DB Mapping Note: ระบบจะแปลง appointmentDate + appointmentSlot ลงคอลัมน์ appointment_datetime ใน DB (เช่น MORNING = 09:00:00, AFTERNOON = 13:00:00)

Request Body (JSON)
{
  "technicianId": 5,
  "urgency": "NORMAL",
  "appointmentDate": "2026-11-30",
  "appointmentSlot": "AFTERNOON",
  "appointmentNote": "ช่างจะเข้ามาช่วง 13:30 น."
}

Response (200 OK)
{
  "requestId": 1021,
  "status": "IN_PROGRESS",
  "urgency": "NORMAL",
  "technicianId": 5,
  "appointmentDate": "2026-11-30",
  "appointmentSlot": "AFTERNOON",
  "appointmentNote": "ช่างจะเข้ามาช่วง 13:30 น.",
  "updatedAt": "2026-10-18T11:00:00"
}

Error Responses (2.4 Specific Cases):
- 400 Bad Request:
  - ช่างประเภทไม่ตรงกับคำร้อง (Technician specialty does not match request category)
  - วันนัดใหม่ไม่มีหมายเหตุ หรือเป็นวันที่อยู่ในอดีต
  - คำร้องไม่ได้อยู่ในสถานะ PENDING
- 404 Not Found: ไม่พบคำร้องแจ้งซ่อม หรือไม่พบข้อมูลช่าง

### 2.5 Get Technicians Filtered by Specialty and Slot (U6)
- Endpoint: GET /api/staff/technicians
- Role: STAFF
- Query Parameters:
  - category (optional): กรองตามความเชี่ยวชาญ (เช่น ELECTRICAL, PLUMBING)
  - date (optional): วันที่นัดหมาย (YYYY-MM-DD)
  - slot (optional): ช่วงเวลา (MORNING / AFTERNOON)
- Description: ดึงรายชื่อช่างพร้อมคืนค่า appointmentCount เพื่อให้นำไปแสดงใน UI หน้า U6 ว่า "มีนัดแล้ว N งาน" (ตัวอย่างช่าง id 5 อ้างอิงตาม init.sql เป็นช่างไฟฟ้า / tech01)

Response (200 OK)
[
  {
    "id": 5,
    "fullName": "ช่างวิชัย สายลม",
    "specialty": "ELECTRICAL",
    "phone": "089-555-0148",
    "appointmentCount": 2
  }
]

### 2.6 Get Technician's Completed Tasks (Paginated)
- Endpoint: GET /api/technician/repair-requests/completed
- Role: TECHNICIAN
- Query Parameters:
  - page (optional, default: 0)
  - size (optional, default: 10)
- Description: แยกงานที่เสร็จแล้วของช่างออกมาเป็น Endpoint เฉพาะสำหรับช่างคนนั้นแบบแบ่งหน้า

Response (200 OK)
{
  "content": [
    {
      "requestId": 1021,
      "title": "ปลั๊กไฟห้องนอนไหม้",
      "category": "ELECTRICAL",
      "locationType": "ROOM",
      "building": "A2",
      "locationDetail": "ห้อง 405",
      "completedAt": "2026-10-20T15:30:00"
    }
  ],
  "page": 0,
  "size": 10,
  "totalCount": 15,
  "totalPages": 2
}

### 2.7 Complete Repair Task (U8 - ช่างส่งมอบงาน)
- Endpoint: POST /api/technician/repair-requests/{requestId}/complete
- Role: TECHNICIAN
- Content-Type: multipart/form-data
- Description: ช่างบันทึกผลการซ่อม อัปโหลดรูปภาพหลังซ่อม (1–3 รูป, ขนาดไม่เกิน 5MB ต่อรูป) และเปลี่ยนสถานะคำร้องเป็น COMPLETED

Request Body (Multipart / Form-Data)
- repairResult (string, required): รายละเอียดผลการซ่อม
- afterImages (file array, optional): ไฟล์รูปภาพหลังซ่อม 1–3 รูป (jpeg/png, max 5MB/file)

Response (200 OK)
{
  "requestId": 1021,
  "status": "COMPLETED",
  "repairResult": "ทำการเปลี่ยนเต้ารับไฟฟ้าใหม่เรียบร้อยแล้ว",
  "afterImageUrls": [
    "/uploads/1021-after-1.jpg"
  ],
  "completedAt": "2026-10-25T10:30:00"
}

Error Responses (2.7 Specific Cases):
- 400 Bad Request:
  - ไฟล์รูปภาพมีขนาดเกิน 5MB หรืออัปโหลดเกิน 3 รูป
  - คำร้องไม่ได้อยู่ในสถานะ IN_PROGRESS
  - ช่างที่ล็อกอินอยู่ไม่ใช่ช่างที่ได้รับมอบหมายงานนี้
- 404 Not Found: ไม่พบ requestId ในระบบ

### 2.8 Common Error Response Structure (400 / 403)
- 400 Bad Request: ข้อมูลใน Request Body ไม่ถูกต้อง หรือ Validation ไม่ผ่าน
- 403 Forbidden: ไม่มีสิทธิ์ในการเข้าถึง Endpoint นั้น ๆ

Error Response Example (400 Bad Request)
{
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid technician ID or request not in PENDING status",
  "timestamp": "2026-10-25T01:54:00"
}