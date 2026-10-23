# API Specification - Sprint 2 (U4 - U8)
## 1. Resident APIs (ผู้พักอาศัย)

### 1.1 Get Resident Repair Request Detail
- Endpoint: GET /api/resident/repair-requests/{id}
- Role: RESIDENT
- Description: ดึงรายละเอียดรายการแจ้งซ่อมของผู้พักอาศัย (ส่ง appointmentNote เพิ่มเติม และส่งเฉพาะรูปที่ผู้แจ้งแนบ imageUrls โดยผลการซ่อมแสดงผ่านประวัติสถานะเดิม ไม่ส่งรูปหลังซ่อม)

Response (200 OK)
{
  "id": 1021,
  "category": "PLUMBING",
  "locationType": "ROOM",
  "details": "ท่อน้ำอุดตันในห้องน้ำ",
  "urgency": "NORMAL",
  "appointmentDate": "2026-11-30",
  "appointmentSlot": "AFTERNOON",
  "appointmentNote": "ช่างจะเข้ามาช่วง 13:30 น.",
  "imageUrls": [
    "/uploads/1021-1.jpg"
  ],
  "statusHistory": [
    {
      "status": "PENDING",
      "updatedAt": "2026-10-18T10:00:00"
    },
    {
      "status": "IN_PROGRESS",
      "updatedAt": "2026-10-18T12:00:00"
    }
  ],
  "createdAt": "2026-10-18T10:00:00"
}

## 2. Staff & Technician APIs (เจ้าหน้าที่และช่าง)

### 2.1 Get All Repair Requests (Staff) / Completed Work (Technician) - Paginated
- Endpoint: GET /api/staff/repair-requests
- Role: STAFF, TECHNICIAN
- Query Parameters:
  - page (optional, เริ่มที่ 0, default: 0)
  - size (optional, default: 10)
  - status (optional: PENDING / IN_PROGRESS / COMPLETED)
- Description: ดึงรายการคำร้องแบบแบ่งหน้า โดยตอบกลับเป็นโครงสร้าง Pageable พร้อม totalCount และ totalPages

Response (200 OK)
{
  "content": [
    {
      "id": 1021,
      "category": "PLUMBING",
      "locationType": "ROOM",
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
- Description: ดึงงานที่ต้องทำของช่าง ส่งวันนัด (appointmentDate) กลับมาให้หน้าเว็บจัดกลุ่ม (วันนี้ / พรุ่งนี้ / ถัดไป) โดยเรียงลำดับตามวันนัด และให้งานเร่งด่วนขึ้นก่อน

Response (200 OK)
[
  {
    "id": 1021,
    "category": "PLUMBING",
    "locationType": "ROOM",
    "urgency": "URGENT",
    "appointmentDate": "2026-10-24",
    "appointmentSlot": "MORNING",
    "appointmentNote": "ท่อแตกเร่งด่วน"
  }
]

### 2.3 Get Staff Repair Request Detail / Technician Job Detail
- Endpoint: GET /api/staff/repair-requests/{id}
- Role: STAFF, TECHNICIAN
- Description: รายละเอียดคำร้องสำหรับเจ้าหน้าที่ และหน้ารายละเอียดงานที่เสร็จแล้วสำหรับช่าง ส่งข้อมูลช่างที่รับงาน, วันนัดที่ยืนยัน, ความเร่งด่วน, ประวัติสถานะ, ผลการซ่อม และรูปหลังซ่อมครบถ้วน (ใช้กับหน้าอ่านอย่างเดียวหลังมอบหมาย)

Response (200 OK)
{
  "id": 1021,
  "category": "PLUMBING",
  "locationType": "ROOM",
  "details": "ท่อน้ำอุดตันในห้องน้ำ",
  "urgency": "NORMAL",
  "status": "COMPLETED",
  "technician": {
    "id": 5,
    "fullName": "ช่างวิชัย สายลม",
    "phone": "089-555-0148"
  },
  "appointmentDate": "2026-11-30",
  "appointmentSlot": "AFTERNOON",
  "appointmentNote": "ซ่อมท่ออุดตันเรียบร้อยแล้ว",
  "imageUrls": [
    "/uploads/1021-1.jpg"
  ],
  "afterImageUrls": [
    "/uploads/1021-after-1.jpg"
  ],
  "statusHistory": [
    {
      "status": "PENDING",
      "updatedAt": "2026-10-18T10:00:00"
    },
    {
      "status": "COMPLETED",
      "updatedAt": "2026-10-18T14:30:00"
    }
  ],
  "createdAt": "2026-10-18T10:00:00"
}

### 2.4 Assign Technician, Urgency, and Appointment (Single API)
- Endpoint: PUT /api/staff/repair-requests/{id}/assign
- Role: STAFF
- Description: มอบหมายงานรับความเร่งด่วน (NORMAL/URGENT) ไปพร้อมรหัสช่าง (technicianId), วันนัด, และหมายเหตุ (appointmentNote) ในคำขอเดียว (ไม่มี API บันทึกความเร่งด่วนแยก)

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
  "id": 1021,
  "status": "IN_PROGRESS",
  "urgency": "NORMAL",
  "technicianId": 5,
  "appointmentDate": "2026-11-30",
  "appointmentSlot": "AFTERNOON",
  "appointmentNote": "ช่างจะเข้ามาช่วง 13:30 น.",
  "updatedAt": "2026-10-18T11:00:00"
}

### 2.5 Get Technicians Filtered by Specialty
- Endpoint: GET /api/staff/technicians
- Role: STAFF
- Query Parameters:
  - category (optional): กรองรายชื่อช่างตามความเชี่ยวชาญ (users.specialty) ให้ตรงกับหมวดหมู่คำร้อง (เช่น PLUMBING, ELECTRICAL)
- Description: ดึงรายชื่อช่างเพื่อใช้เลือกมอบหมายงานให้สอดคล้องกับประเภทงานซ่อม

Response (200 OK)
[
  {
    "id": 5,
    "fullName": "ช่างวิชัย สายลม",
    "specialty": "PLUMBING",
    "phone": "089-555-0148"
  }
]

### 2.6 Error Responses (Common for 400 / 403)
- 400 Bad Request: ข้อมูลใน Request Body ไม่ถูกต้อง หรือ Validation ไม่ผ่าน
- 403 Forbidden: ไม่มีสิทธิ์ในการเข้าถึง Endpoint นั้น ๆ (ตรวจสอบ Role)

Error Response Example (400 Bad Request)
{
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid urgency or technician ID",
  "timestamp": "2026-10-24T12:00:00"
}