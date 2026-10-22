# API Spec — Sprint 1 (Release 1.0.0)

ระบบแจ้งซ่อมภายในหอพัก · CS261 กลุ่ม 3 section 650001

เอกสารนี้เขียนย้อนหลังจากโค้ดใน `develop` หลัง Release 1.0.0 (22 ต.ค. 2569) ครอบคลุม User Story ของ Sprint 1

| User Story | ชื่อ | Endpoint |
|---|---|---|
| U1 | ผู้พักอาศัยเขียนคำร้องแจ้งซ่อม | `POST /api/repair-requests` |
| U2 | ผู้พักอาศัยเข้าสู่ระบบ / ออกจากระบบ | `POST /api/auth/login`, `POST /api/auth/logout` |
| U3 | ผู้พักอาศัยตรวจสอบประวัติกับสถานะ | `GET /api/repair-requests/my`, `GET /api/repair-requests/{id}` |

---

## 1. ข้อตกลงทั่วไป

### 1.1 Base URL และ CORS
| รายการ | ค่า |
|---|---|
| Backend | `http://localhost:8080` |
| Frontend ที่เรียกได้ (CORS) | `http://localhost:3000` |
| Method ที่เปิดไว้ | GET, POST, PUT, DELETE, OPTIONS |

### 1.2 การยืนยันตัวตน (token)
- เรียก `POST /api/auth/login` สำเร็จจะได้ `token` (UUID)
- API ที่ต้องรู้ว่าใครเรียก ให้ส่ง header `Authorization: Bearer <token>`
- ไม่ส่ง token, token ผิด หรือ token ถูก logout ไปแล้ว → **401** `กรุณาเข้าสู่ระบบใหม่`
- token เก็บในหน่วยความจำของ backend ปิดหรือรีสตาร์ต backend แล้ว token ทุกตัวใช้ไม่ได้ ต้อง login ใหม่
- ฝั่งหน้าเว็บ (`js/api-client.js`) แนบ token ให้อัตโนมัติ และเมื่อได้ 401 จาก API ใดก็ตาม (ยกเว้น login) จะล้าง `localStorage` แล้วพาไปหน้า `login.html`

### 1.3 รูปแบบ error
ทุก error ใช้ `ResponseStatusException` ของ Spring ซึ่งตอบเป็น JSON รูปแบบเดียวกัน หน้าเว็บอ่าน `message` ไปแสดงให้ผู้ใช้

```json
{
  "timestamp": "2026-10-22T14:30:00.000+07:00",
  "status": 400,
  "error": "Bad Request",
  "message": "วันที่นัดหมายต้องไม่เป็นอดีต",
  "path": "/api/repair-requests"
}
```

| Status | ใช้เมื่อ |
|---|---|
| 400 Bad Request | ข้อมูลที่ส่งมาไม่ครบหรือไม่ถูกต้อง |
| 401 Unauthorized | ไม่ได้ login / token ใช้ไม่ได้ / รหัสผ่านผิดตอน login |
| 404 Not Found | ไม่พบข้อมูล หรือข้อมูลไม่ใช่ของผู้เรียก |
| 500 Internal Server Error | บันทึกไฟล์รูปไม่สำเร็จ |

### 1.4 รูปแบบวันที่
| ชนิด | รูปแบบ | ตัวอย่าง |
|---|---|---|
| วันที่ (`LocalDate`) | `YYYY-MM-DD` | `2026-10-14` |
| วันเวลา (`LocalDateTime`) | `YYYY-MM-DDTHH:mm:ss` (ไม่มีโซนเวลา) | `2026-10-14T13:00:00` |

### 1.5 ค่า enum
| ฟิลด์ | ค่าที่ใช้ได้ | ความหมาย |
|---|---|---|
| `role` | `RESIDENT` / `STAFF` / `TECHNICIAN` | ผู้พักอาศัย / เจ้าหน้าที่ / ช่างซ่อม |
| `locationType` | `ROOM` / `COMMON_AREA` | ห้องพัก / พื้นที่ส่วนกลาง |
| `category` | `ELECTRICAL` / `PLUMBING` / `AIR_CONDITIONER` / `FURNITURE` / `OTHER` | ไฟฟ้า / ประปา / เครื่องปรับอากาศ / เฟอร์นิเจอร์ / อื่นๆ |
| `preferredSlot1`, `preferredSlot2` | `MORNING` / `AFTERNOON` | 09:00–12:00 / 13:00–16:00 |
| `status` | `PENDING` / `IN_PROGRESS` / `COMPLETED` | รอรับเรื่อง / กำลังดำเนินการ / เสร็จสิ้น |
| `urgency` | `NORMAL` / `URGENT` | ปกติ / เร่งด่วน |

---

## 2. สรุป Endpoint

| # | Method | URL | Token | Story | สำเร็จ |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | ไม่ต้อง | U2 | 200 |
| 2 | POST | `/api/auth/logout` | ส่งถ้ามี | U2 | 200 |
| 3 | POST | `/api/repair-requests` | ต้อง | U1 | 201 |
| 4 | GET | `/api/repair-requests/my` | ต้อง | U3 | 200 |
| 5 | GET | `/api/repair-requests/{id}` | ต้อง | U3 | 200 |
| 6 | GET | `/uploads/{fileName}` | ไม่ต้อง | U1, U3 | 200 (ไฟล์รูป) |

---

## 3. U2 เข้าสู่ระบบ / ออกจากระบบ

### 3.1 `POST /api/auth/login`
เข้าสู่ระบบด้วย username และรหัสผ่าน ใช้ได้ทุกบทบาท

**Request** — `Content-Type: application/json`
```json
{
  "username": "resident01",
  "password": "password123"
}
```

**Response 200** — `LoginResponseDTO`
```json
{
  "token": "6f1c2a7e-3b9d-4c51-9e0a-2d7f8b4c1a90",
  "userId": 1,
  "fullName": "สมชาย ใจดี",
  "role": "RESIDENT",
  "roomNumber": "A-305"
}
```
| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `token` | string | ใช้ใน header `Authorization: Bearer <token>` |
| `userId` | number | |
| `fullName` | string | |
| `role` | string | ดูค่าที่ 1.5 หน้าเว็บใช้เลือกว่าจะพาไปหน้าแรกของบทบาทไหน |
| `roomNumber` | string \| null | มีเฉพาะผู้พักอาศัย บทบาทอื่นเป็น `null` |

ไม่ส่ง `passwordHash` หรือ entity `User` กลับไปเด็ดขาด

**Error**
| Status | กรณี | message |
|---|---|---|
| 400 | username หรือ password ว่าง | `กรุณากรอกชื่อผู้ใช้และรหัสผ่าน` |
| 401 | ไม่มี username นี้ หรือรหัสผ่านผิด | `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง` |

ตอบข้อความเดียวกันทั้งกรณีไม่มี username และรหัสผิด เพื่อไม่บอกใบ้ว่ามี username นี้ในระบบหรือไม่

**การตรวจรหัสผ่าน:** `BCryptPasswordEncoder.matches(password, users.password_hash)` ในฐานข้อมูลเก็บเฉพาะค่า BCrypt

**SQL:** `SELECT * FROM users WHERE username = ?`

### 3.2 `POST /api/auth/logout`
ลบ token ออกจากระบบ หลังจากนี้ใช้ token เดิมเรียก API จะได้ 401

**Request** — ไม่มี body, header `Authorization: Bearer <token>`

**Response 200**
```json
{ "message": "ออกจากระบบแล้ว" }
```

ไม่ส่ง token หรือ token ใช้ไม่ได้อยู่แล้ว ก็ยังตอบ 200 (หน้าเว็บล้าง `localStorage` แล้วไปหน้า login เสมอ)

---

## 4. U1 ส่งคำร้องแจ้งซ่อม

### 4.1 `POST /api/repair-requests`
ผู้พักอาศัยสร้างคำร้องแจ้งซ่อมพร้อมรูปภาพ คำร้องใหม่มีสถานะ `PENDING` (รอรับเรื่อง)

**Request** — `Content-Type: multipart/form-data`, header `Authorization: Bearer <token>`

ฝั่ง JS ส่งด้วย `FormData` และห้ามตั้ง `Content-Type` เอง (เบราว์เซอร์ใส่ boundary ให้)

| ฟิลด์ | ชนิด | บังคับ | เงื่อนไข / หมายเหตุ |
|---|---|---|---|
| `locationType` | enum | ✓ | `ROOM` / `COMMON_AREA` |
| `building` | string | ✓ | ไม่เกิน 50 ตัวอักษร เช่น `อาคาร A` |
| `locationDetail` | string | ✓ | ไม่เกิน 100 ตัวอักษร เช่น `ชั้น 3 · ห้อง 305` |
| `category` | enum | ✓ | ดูค่าที่ 1.5 |
| `title` | string | ✓ | ช่อง "อุปกรณ์ที่ชำรุด" ใช้เป็นชื่อคำร้อง ไม่เกิน 100 ตัวอักษร |
| `description` | string | ✓ | รายละเอียดปัญหา ไม่เกิน 1000 ตัวอักษร |
| `preferredDate1` | date | ✓ | วันที่สะดวกช่วงที่ 1 ต้องไม่เป็นวันในอดีต |
| `preferredSlot1` | enum | ✓ | `MORNING` / `AFTERNOON` |
| `preferredDate2` | date | | ช่วงที่ 2 ต้องกรอกทั้งวันและช่วงเวลา หรือเว้นว่างทั้งคู่ วันต้องไม่เป็นอดีต |
| `preferredSlot2` | enum | | เหมือน `preferredDate2` |
| `contactPhone` | string | ✓ | ไม่เกิน 20 ตัวอักษร |
| `lineId` | string | | ไม่เกิน 50 ตัวอักษร |
| `urgency` | enum | | ผู้พักอาศัยติ๊ก "แจ้งว่าเร่งด่วน" → `URGENT` ไม่ส่งมา → `NORMAL` (เจ้าหน้าที่ยืนยันหรือเปลี่ยนได้ใน Sprint 2) |
| `images` | file[] | ✓ | 1–3 ไฟล์ แต่ละไฟล์เป็น JPG/PNG และไม่เกิน 5 MB (ส่งหลายไฟล์ด้วยชื่อฟิลด์ `images` ซ้ำกัน) |

**Response 201** — `RepairRequestResponseDTO` (รูปแบบเดียวกับข้อ 5.2) ตัวอย่างส่วนที่สำคัญ
```json
{
  "requestId": 1025,
  "status": "PENDING",
  "urgency": "NORMAL",
  "technician": null,
  "appointmentDateTime": null,
  "imageUrls": ["/uploads/1025-1.jpg", "/uploads/1025-2.png"],
  "statusHistory": [
    {
      "status": "PENDING",
      "note": "สร้างคำร้องสำเร็จพร้อมรูปภาพ 2 รูป",
      "changedAt": "2026-10-22T14:30:00",
      "changedByName": "สมชาย ใจดี"
    }
  ],
  "createdAt": "2026-10-22T14:30:00"
}
```

**Error** (ตรวจตามลำดับนี้ เจอข้อแรกที่ผิดก็ตอบทันที)
| Status | กรณี | message |
|---|---|---|
| 401 | ไม่ส่ง token / token ใช้ไม่ได้ | `กรุณาเข้าสู่ระบบใหม่` |
| 400 | ฟิลด์บังคับข้อใดข้อหนึ่งว่าง | `กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน` |
| 400 | ข้อความยาวเกินกำหนด | `ช่อง<ชื่อช่อง> ยาวเกิน <N> ตัวอักษร` เช่น `ช่องอาคาร ยาวเกิน 50 ตัวอักษร` |
| 400 | กรอกช่วงที่ 2 ไม่ครบ (มีวันแต่ไม่มีช่วงเวลา หรือกลับกัน) | `กรุณากรอกวันและช่วงเวลาที่สะดวกช่วงที่ 2 ให้ครบ` |
| 400 | `preferredDate1` หรือ `preferredDate2` เป็นวันในอดีต | `วันที่นัดหมายต้องไม่เป็นอดีต` |
| 400 | แนบรูปเกิน 3 รูป | `แนบรูปได้ไม่เกิน 3 รูป` |
| 400 | ไฟล์รูปว่าง | `กรุณาแนบไฟล์รูปภาพ` |
| 400 | ไฟล์ไม่ใช่ JPG/PNG | `รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB` |
| 404 | ไม่พบผู้ใช้ของ token | `ไม่พบข้อมูลผู้ใช้งานระบบ` |
| 500 | บันทึกไฟล์รูปลงดิสก์ไม่สำเร็จ | `บันทึกรูปไม่สำเร็จ` |

หมายเหตุเรื่องรูป: ถ้าไม่ส่งฟิลด์ `images` เลย หรือไฟล์ใหญ่เกิน 5 MB Spring จะตอบ error ของตัวเองก่อนถึงโค้ดของเรา (ข้อความเป็นภาษาอังกฤษ) หน้าแจ้งซ่อมจึงตรวจจำนวนและขนาดรูปฝั่งหน้าเว็บก่อนส่งทุกครั้ง

**การบันทึก**
1. บันทึกคำร้อง (`status = PENDING`) เพื่อให้ได้ `requestId`
2. บันทึกรูปลงโฟลเดอร์ `uploads/` ตั้งชื่อ `<requestId>-<ลำดับ>.<jpg|png>` แล้วบันทึกที่อยู่ไฟล์และขนาด
3. บันทึกประวัติสถานะแถวแรก `PENDING` โดยผู้แจ้ง

**SQL**
```sql
SELECT * FROM users WHERE user_id = ?
INSERT INTO repair_requests (resident_id, location_type, building, location_detail, category, title, description,
  preferred_date_1, preferred_slot_1, preferred_date_2, preferred_slot_2, contact_phone, line_id, status, urgency, ...)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ...)
INSERT INTO request_images (request_id, file_path, file_size, ...) VALUES (?, ?, ?, ...)      -- 1 แถวต่อรูป
INSERT INTO request_status_history (request_id, status, note, changed_by, ...) VALUES (?, 'PENDING', ?, ?, ...)
```

---

## 5. U3 ตรวจสอบประวัติกับสถานะ

### 5.1 `GET /api/repair-requests/my`
รายการคำร้องของผู้ใช้ที่ login อยู่ เรียงจากใหม่ไปเก่า (`createdAt` มากไปน้อย) ใช้ในหน้า "ประวัติคำร้อง"

**Request** — header `Authorization: Bearer <token>`

**Response 200** — `RepairRequestSummaryDTO[]` ยังไม่มีคำร้องได้ `[]`
```json
[
  {
    "requestId": 1024,
    "title": "ไฟห้องน้ำดับ",
    "category": "ELECTRICAL",
    "status": "PENDING",
    "technicianName": null,
    "createdAt": "2026-10-12T10:00:00",
    "updatedAt": "2026-10-12T10:00:00"
  },
  {
    "requestId": 1019,
    "title": "ก๊อกน้ำอ่างล้างหน้ารั่ว",
    "category": "PLUMBING",
    "status": "IN_PROGRESS",
    "technicianName": "วิชัย สายลม",
    "createdAt": "2026-10-10T08:40:00",
    "updatedAt": "2026-10-10T09:15:00"
  }
]
```
`technicianName` เป็น `null` เมื่อยังไม่มอบหมายช่าง

**Error**
| Status | กรณี | message |
|---|---|---|
| 401 | ไม่ส่ง token / token ใช้ไม่ได้ | `กรุณาเข้าสู่ระบบใหม่` |

**SQL:** `SELECT * FROM repair_requests WHERE resident_id = ? ORDER BY created_at DESC`

### 5.2 `GET /api/repair-requests/{id}`
รายละเอียดคำร้อง รูปที่แนบ และประวัติสถานะ ใช้ในหน้า "ตรวจสอบคำร้อง" (เปิดจากหน้าประวัติคำร้อง)

**Request** — header `Authorization: Bearer <token>`, `id` = `requestId`

**Response 200** — `RepairRequestResponseDTO`
```json
{
  "requestId": 1019,
  "locationType": "ROOM",
  "building": "อาคาร A",
  "locationDetail": "ชั้น 3 · ห้อง 305",
  "category": "PLUMBING",
  "title": "ก๊อกน้ำอ่างล้างหน้ารั่ว",
  "description": "น้ำหยดจากก๊อกอ่างล้างหน้าตลอดเวลา ปิดสุดแล้วก็ยังไม่หยุด",
  "preferredDate1": "2026-10-13",
  "preferredSlot1": "MORNING",
  "preferredDate2": "2026-10-14",
  "preferredSlot2": "AFTERNOON",
  "appointmentDateTime": "2026-10-14T13:00:00",
  "contactPhone": "081-234-5678",
  "lineId": "somchai305",
  "status": "IN_PROGRESS",
  "urgency": "URGENT",
  "technician": { "name": "วิชัย สายลม", "phone": "089-555-0148" },
  "imageUrls": ["/uploads/1019-1.jpg", "/uploads/1019-2.jpg"],
  "statusHistory": [
    { "status": "PENDING", "note": "ส่งคำร้องพร้อมรูปภาพ 2 รูป", "changedAt": "2026-10-10T08:40:00", "changedByName": "สมชาย ใจดี" },
    { "status": "IN_PROGRESS", "note": "รับเรื่องและมอบหมายช่าง วิชัย สายลม นัดเข้าซ่อม 14/10/2569 13:00", "changedAt": "2026-10-10T09:15:00", "changedByName": "สุดา พรศรี" }
  ],
  "createdAt": "2026-10-10T08:40:00"
}
```

| ฟิลด์ | หมายเหตุ |
|---|---|
| `preferredDate2`, `preferredSlot2` | `null` ถ้าผู้พักอาศัยไม่ได้กรอกช่วงที่ 2 |
| `appointmentDateTime` | วันเวลานัดที่เจ้าหน้าที่ยืนยัน `null` จนกว่าจะมอบหมายช่าง (Sprint 2) |
| `lineId` | `null` ถ้าไม่ได้กรอก |
| `technician` | `{ name, phone }` ของช่างที่รับงาน `null` ถ้ายังไม่มอบหมาย |
| `imageUrls` | path ของรูป เปิดด้วย `http://localhost:8080` + path (ฟังก์ชัน `imageUrl()` ใน `api-client.js`) |
| `statusHistory` | เรียงตามลำดับที่เกิด ใช้แสดงไทม์ไลน์สถานะ |

**Error**
| Status | กรณี | message |
|---|---|---|
| 401 | ไม่ส่ง token / token ใช้ไม่ได้ | `กรุณาเข้าสู่ระบบใหม่` |
| 404 | ไม่มีคำร้องนี้ หรือเป็นคำร้องของผู้พักอาศัยคนอื่น | `ไม่พบคำร้องนี้` |

ตอบ 404 เหมือนกันทั้งสองกรณี ผู้ใช้จึงเดาเลขคำร้องของคนอื่นไม่ได้ว่ามีอยู่จริงหรือไม่

**SQL**
```sql
SELECT * FROM repair_requests WHERE request_id = ? AND resident_id = ?
SELECT * FROM users WHERE user_id = ?                                           -- ช่าง (ถ้ามี)
SELECT * FROM request_images WHERE request_id = ?
SELECT * FROM request_status_history WHERE request_id = ?                       -- พร้อมชื่อผู้เปลี่ยนสถานะ
```

---

## 6. ไฟล์รูป

### 6.1 `GET /uploads/{fileName}`
เปิดไฟล์รูปที่อยู่ใน `imageUrls` ไม่ต้องใช้ token (ใช้ใน `<img src>` ได้ตรงๆ)

Backend หาไฟล์ใน `uploads/` (รูปที่ผู้ใช้อัปโหลด) ก่อน ถ้าไม่เจอจะหาในรูปตัวอย่างของข้อมูลใน `init.sql` (`resources/seed-uploads`) ไม่พบทั้งสองที่ → 404

---

## 7. หมายเหตุสำหรับ Sprint 2

- **`POST /api/upload/image`** มีอยู่ในโค้ด (`FileUploadController`) แต่หน้าเว็บไม่ได้เรียกใช้ เพราะ U1 ส่งรูปไปพร้อมคำร้องในคำขอเดียว และ endpoint นี้ไม่ตรวจ token ใครก็อัปโหลดไฟล์ได้ ควรตัดสินใจว่าจะลบทิ้ง หรือใส่ `requireUserId` ก่อน Release 2
- API ของ Sprint 1 ยังไม่ตรวจบทบาท (role) เช่น ผู้ใช้บทบาทอื่นก็เรียก `POST /api/repair-requests` ได้ ถ้า Sprint 2 เพิ่ม API ของเจ้าหน้าที่และช่าง ควรตอบ **403** เมื่อบทบาทไม่ตรง
- API ของ Sprint 2 ดูที่ `docs/api-spec-sprint2.md`
