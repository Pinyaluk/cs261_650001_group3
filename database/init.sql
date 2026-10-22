/* =====================================================================
   ระบบแจ้งซ่อมหอพัก · CS261 กลุ่ม 3 section 650001
   SQL script สร้างตาราง + ข้อมูลตั้งต้น (Sprint 2: U4–U8)

   รันซ้ำได้: ลบตารางเดิมทิ้งแล้วสร้างใหม่ ข้อมูลที่ทดสอบไว้จะหายหมด
   บัญชีทดสอบทุกบัญชีใช้รหัสผ่าน password123 (เก็บเป็น BCrypt)
   ===================================================================== */

IF DB_ID(N'dorm_repair') IS NULL
    CREATE DATABASE dorm_repair COLLATE Thai_CI_AS;
GO

USE dorm_repair;
GO

/* ---------- ลบตารางเดิม (ลูกก่อน แม่ทีหลัง) ---------- */
DROP TABLE IF EXISTS request_status_history;
DROP TABLE IF EXISTS request_images;
DROP TABLE IF EXISTS repair_requests;
DROP TABLE IF EXISTS users;
GO

/* ---------- users ---------- */
CREATE TABLE users (
    user_id        INT IDENTITY(1,1) NOT NULL,
    username       VARCHAR(50)       NOT NULL,
    password_hash  VARCHAR(255)      NOT NULL,
    full_name      NVARCHAR(100)     NOT NULL,
    role           VARCHAR(20)       NOT NULL,
    specialty      VARCHAR(30)       NULL,      -- เฉพาะช่าง: ELECTRICAL, PLUMBING, AIR_CONDITIONER, FURNITURE, OTHER
    room_number    VARCHAR(20)       NULL,      -- ใช้กับผู้พักอาศัย
    phone          VARCHAR(20)       NULL,      -- แสดงเบอร์ช่างและเจ้าหน้าที่
    created_at     DATETIME2         NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSDATETIME(),

    CONSTRAINT pk_users           PRIMARY KEY (user_id),
    CONSTRAINT uq_users_username  UNIQUE (username),
    CONSTRAINT ck_users_role      CHECK (role IN ('RESIDENT', 'STAFF', 'TECHNICIAN')),
    CONSTRAINT ck_users_specialty CHECK (specialty IS NULL OR specialty IN ('ELECTRICAL', 'PLUMBING', 'AIR_CONDITIONER', 'FURNITURE', 'OTHER'))
);
GO

/* ---------- repair_requests ---------- */
CREATE TABLE repair_requests (
    request_id            INT IDENTITY(1000,1) NOT NULL,
    resident_id           INT            NOT NULL,
    technician_id         INT            NULL,      -- ช่างที่ได้รับมอบหมาย (Sprint 2)
    location_type         VARCHAR(20)    NOT NULL,
    building              NVARCHAR(50)   NOT NULL,
    location_detail       NVARCHAR(100)  NOT NULL,
    category              VARCHAR(30)    NOT NULL,
    title                 NVARCHAR(100)  NOT NULL,  -- ช่อง "อุปกรณ์ที่ชำรุด"
    description           NVARCHAR(1000) NOT NULL,
    preferred_date_1      DATE           NOT NULL,
    preferred_slot_1      VARCHAR(20)    NOT NULL,
    preferred_date_2      DATE           NULL,
    preferred_slot_2      VARCHAR(20)    NULL,
    appointment_datetime  DATETIME2      NULL,      -- เจ้าหน้าที่ยืนยัน (< 12:00 = MORNING, >= 12:00 = AFTERNOON)
    appointment_note      NVARCHAR(500)  NULL,     -- หมายเหตุวันนัดจากเจ้าหน้าที่ (U6)
    contact_phone         VARCHAR(20)    NOT NULL,
    line_id               VARCHAR(50)    NULL,
    status                VARCHAR(20)    NOT NULL CONSTRAINT df_rr_status     DEFAULT 'PENDING',
    urgency               VARCHAR(20)    NOT NULL CONSTRAINT df_rr_urgency    DEFAULT 'NORMAL',
    created_at            DATETIME2      NOT NULL CONSTRAINT df_rr_created_at DEFAULT SYSDATETIME(),
    updated_at            DATETIME2      NOT NULL CONSTRAINT df_rr_updated_at DEFAULT SYSDATETIME(),

    CONSTRAINT pk_repair_requests PRIMARY KEY (request_id),
    CONSTRAINT fk_rr_resident     FOREIGN KEY (resident_id)   REFERENCES users (user_id),
    CONSTRAINT fk_rr_technician   FOREIGN KEY (technician_id) REFERENCES users (user_id),
    CONSTRAINT ck_rr_location     CHECK (location_type IN ('ROOM', 'COMMON_AREA')),
    CONSTRAINT ck_rr_category     CHECK (category IN ('ELECTRICAL', 'PLUMBING', 'AIR_CONDITIONER', 'FURNITURE', 'OTHER')),
    CONSTRAINT ck_rr_slot1        CHECK (preferred_slot_1 IN ('MORNING', 'AFTERNOON')),
    CONSTRAINT ck_rr_slot2        CHECK (preferred_slot_2 IN ('MORNING', 'AFTERNOON')),
    -- ช่วงที่ 2 ต้องกรอกทั้งวันและช่วงเวลา หรือว่างทั้งคู่
    CONSTRAINT ck_rr_slot2_pair   CHECK ((preferred_date_2 IS NULL AND preferred_slot_2 IS NULL)
                                      OR (preferred_date_2 IS NOT NULL AND preferred_slot_2 IS NOT NULL)),
    CONSTRAINT ck_rr_status       CHECK (status  IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    CONSTRAINT ck_rr_urgency      CHECK (urgency IN ('NORMAL', 'URGENT'))
);
GO

-- ใช้กับ GET /api/repair-requests/my (คำร้องของผู้ใช้ เรียงล่าสุดก่อน)
CREATE INDEX ix_rr_resident_created ON repair_requests (resident_id, created_at DESC);
GO

CREATE INDEX ix_rr_technician_appt ON repair_requests (technician_id, appointment_datetime);
GO

CREATE INDEX ix_rr_status_created ON repair_requests (status, created_at DESC);
GO

/* ---------- request_images ---------- */
CREATE TABLE request_images (
    image_id     INT IDENTITY(1,1) NOT NULL,
    request_id   INT               NOT NULL,
    image_type   VARCHAR(20)       NOT NULL CONSTRAINT df_img_type DEFAULT 'BEFORE', -- BEFORE: ก่อนซ่อม, AFTER: หลังซ่อม
    file_path    VARCHAR(255)      NOT NULL,
    file_size    INT               NOT NULL,   -- ไบต์ ไม่เกิน 5MB
    uploaded_at  DATETIME2         NOT NULL CONSTRAINT df_img_uploaded_at DEFAULT SYSDATETIME(),

    CONSTRAINT pk_request_images PRIMARY KEY (image_id),
    CONSTRAINT fk_img_request    FOREIGN KEY (request_id) REFERENCES repair_requests (request_id) ON DELETE CASCADE,
    CONSTRAINT ck_img_type       CHECK (image_type IN ('BEFORE', 'AFTER')),
    CONSTRAINT ck_img_size       CHECK (file_size > 0 AND file_size <= 5242880)
);
GO

/* ---------- request_status_history ---------- */
CREATE TABLE request_status_history (
    history_id  INT IDENTITY(1,1) NOT NULL,
    request_id  INT               NOT NULL,
    status      VARCHAR(20)       NOT NULL,
    note        NVARCHAR(500)     NULL,      -- ข้อความใต้แต่ละขั้น / ผลการซ่อมเมื่อสถานะ COMPLETED
    changed_by  INT               NOT NULL,
    changed_at  DATETIME2         NOT NULL CONSTRAINT df_hist_changed_at DEFAULT SYSDATETIME(),

    CONSTRAINT pk_request_status_history PRIMARY KEY (history_id),
    CONSTRAINT fk_hist_request   FOREIGN KEY (request_id) REFERENCES repair_requests (request_id) ON DELETE CASCADE,
    CONSTRAINT fk_hist_user      FOREIGN KEY (changed_by) REFERENCES users (user_id),
    CONSTRAINT ck_hist_status    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED'))
);
GO

CREATE INDEX ix_hist_request ON request_status_history (request_id, changed_at);
GO

/* =====================================================================
   ข้อมูลตั้งต้น
   ===================================================================== */

/* ---------- บัญชีทดสอบ (รหัสผ่าน password123) ---------- */
SET IDENTITY_INSERT users ON;
INSERT INTO users (user_id, username, password_hash, full_name, role, specialty, room_number, phone) VALUES
 -- ผู้พักอาศัย (1-3)
 (1,  'resident01', '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'สมชาย ใจดี',      'RESIDENT',   NULL,              'A-305', '081-234-5678'),
 (2,  'resident02', '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'มานี มีสุข',      'RESIDENT',   NULL,              'B-210', '082-345-6789'),
 (3,  'resident03', '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'ปิติ ชูใจ',       'RESIDENT',   NULL,              'C-102', '083-456-7890'),

 -- เจ้าหน้าที่ (4)
 (4,  'staff01',    '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'สุดา พรศรี',      'STAFF',      NULL,              NULL,    '02-555-0180'),

 -- ช่างซ่อมบำรุง 10 คน (ประเภทละ 2 คน: 5-14)
 (5,  'tech01',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'วิชัย สายลม',     'TECHNICIAN', 'ELECTRICAL',      NULL,    '089-555-0101'),
 (6,  'tech02',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'สมศักดิ์ วงจรดี',  'TECHNICIAN', 'ELECTRICAL',      NULL,    '089-555-0102'),
 (7,  'tech03',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'ชาญชัย ท่อน้ำดี',  'TECHNICIAN', 'PLUMBING',        NULL,    '089-555-0103'),
 (8,  'tech04',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'ประเสริฐ ประปาไทย', 'TECHNICIAN', 'PLUMBING',        NULL,    '089-555-0104'),
 (9,  'tech05',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'เกรียงไกร ลมเย็น', 'TECHNICIAN', 'AIR_CONDITIONER', NULL,    '089-555-0105'),
 (10, 'tech06',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'อนุชา เย็นเจี๊ยบ',  'TECHNICIAN', 'AIR_CONDITIONER', NULL,    '089-555-0106'),
 (11, 'tech07',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'บรรพต ไม้งาม',     'TECHNICIAN', 'FURNITURE',        NULL,    '089-555-0107'),
 (12, 'tech08',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'ธนกฤต ช่างไม้',    'TECHNICIAN', 'FURNITURE',        NULL,    '089-555-0108'),
 (13, 'tech09',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'วีระ ช่างสารพัด',  'TECHNICIAN', 'OTHER',            NULL,    '089-555-0109'),
 (14, 'tech10',     '$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy', N'สุรศักดิ์ ซ่อมทั่วไทย','TECHNICIAN', 'OTHER',            NULL,    '089-555-0110');
SET IDENTITY_INSERT users OFF;
GO

/* ---------- คำร้องตั้งต้น ----------
   1024: ELECTRICAL (PENDING - ยังไม่มอบหมายช่าง ผู้แจ้งขอ 30/11/2569 ช่วงเช้า)
   1021: PLUMBING (PENDING - ผู้แจ้งขอ 30/11/2569 ช่วงบ่าย) *** ใช้เทส Test case 6 ของ U6: มอบหมายแล้วเห็นว่า tech03 มีนัด 2 งาน ***
   1019: PLUMBING (IN_PROGRESS - ช่าง ชาญชัย tech03 นัด 30/11/2569 13:00)
   1020: PLUMBING (IN_PROGRESS - ช่าง ชาญชัย tech03 นัด 30/11/2569 14:30)
   1003: AIR_CONDITIONER (COMPLETED - ช่าง เกรียงไกร tech05)
   987:  FURNITURE (COMPLETED - ช่าง บรรพต tech07)
   resident03 ไม่มีคำร้อง (ใช้เทสหน้าประวัติว่าง)
*/
SET IDENTITY_INSERT repair_requests ON;
INSERT INTO repair_requests
 (request_id, resident_id, technician_id, location_type, building, location_detail, category, title, description,
  preferred_date_1, preferred_slot_1, preferred_date_2, preferred_slot_2, appointment_datetime,
  contact_phone, line_id, status, urgency, created_at, updated_at)
VALUES
 (1024, 1, NULL, 'ROOM', N'อาคาร A', N'ชั้น 3 · ห้อง 305', 'ELECTRICAL', N'ไฟห้องน้ำดับ',
  N'หลอดไฟในห้องน้ำไม่ติดตั้งแต่เมื่อวานตอนเย็น',
  '2026-11-30', 'MORNING', NULL, NULL, NULL,
  '081-234-5678', NULL, 'PENDING', 'NORMAL', '2026-10-12T10:00:00', '2026-10-12T10:00:00'),

   (1021, 2, NULL, 'COMMON_AREA', N'อาคาร B', N'ชั้น 1 · ห้องน้ำรวม', 'PLUMBING', N'ชักโครกน้ำไหลไม่หยุด',
  N'กดชักโครกแล้วน้ำไหลไม่หยุด ต้องปิดวาล์วเอง',
  '2026-11-30', 'AFTERNOON', NULL, NULL, NULL,
  '082-345-6789', NULL, 'PENDING', 'NORMAL', '2026-10-21T09:00:00', '2026-10-21T09:00:00'),

 (1019, 1, 7, 'ROOM', N'อาคาร A', N'ชั้น 3 · ห้อง 305', 'PLUMBING', N'ก๊อกน้ำอ่างล้างหน้ารั่ว',
  N'น้ำหยดจากก๊อกอ่างล้างหน้าตลอดเวลา ปิดสุดแล้วก็ยังไม่หยุด',
  '2026-11-28', 'MORNING', '2026-11-30', 'AFTERNOON', '2026-11-30T13:00:00',
  '081-234-5678', 'somchai305', 'IN_PROGRESS', 'URGENT', '2026-10-10T08:40:00', '2026-10-10T09:15:00'),

 -- คำร้อง 1020: ใช้ทดสอบ Test case 6 ของ U6 (ช่าง tech03 มีนัดซ้อนวันที่ 30/11/2569 ช่วงบ่ายเหมือนกัน)
 (1020, 2, 7, 'ROOM', N'อาคาร B', N'ชั้น 2 · ห้อง 210', 'PLUMBING', N'ท่อน้ำทิ้งใต้อ่างรั่วซึม',
  N'ท่อน้ำทิ้งใต้อ่างล้างจานมีน้ำซึมหยดลงพื้นตู้',
  '2026-11-30', 'AFTERNOON', NULL, NULL, '2026-11-30T14:30:00',
  '082-345-6789', NULL, 'IN_PROGRESS', 'NORMAL', '2026-10-11T09:00:00', '2026-10-11T10:30:00'),

 (1003, 1, 9, 'ROOM', N'อาคาร A', N'ชั้น 3 · ห้อง 305', 'AIR_CONDITIONER', N'แอร์ไม่เย็น',
  N'แอร์เปิดแล้วมีแต่ลม ไม่เย็น',
  '2026-09-22', 'MORNING', NULL, NULL, '2026-09-22T10:00:00',
  '081-234-5678', NULL, 'COMPLETED', 'NORMAL', '2026-09-20T14:00:00', '2026-09-23T16:00:00'),

 (987, 2, 11, 'ROOM', N'อาคาร B', N'ชั้น 2 · ห้อง 210', 'FURNITURE', N'บานพับตู้เสื้อผ้าหลุด',
  N'บานพับตู้เสื้อผ้าหลุด ประตูตู้ปิดไม่สนิท',
  '2026-09-15', 'AFTERNOON', '2026-09-16', 'MORNING', '2026-09-16T10:00:00',
  '082-345-6789', NULL, 'COMPLETED', 'NORMAL', '2026-09-14T09:00:00', '2026-09-16T11:00:00');
SET IDENTITY_INSERT repair_requests OFF;
GO

-- คำร้องใหม่ที่ส่งจากหน้าเว็บจะได้เลข 1025 เป็นต้นไป
DBCC CHECKIDENT ('repair_requests', RESEED, 1024);
GO

/* ---------- รูปประกอบ (แยก BEFORE ก่อนซ่อม / AFTER หลังซ่อม) ---------- */
INSERT INTO request_images (request_id, image_type, file_path, file_size, uploaded_at) VALUES
 (1024, 'BEFORE', '/uploads/1024-1.jpg',     14960, '2026-10-12T10:00:00'),
 (1019, 'BEFORE', '/uploads/1019-1.jpg',     18354, '2026-10-10T08:40:00'),
 (1019, 'BEFORE', '/uploads/1019-2.jpg',     16521, '2026-10-10T08:40:00'),
 (1020, 'BEFORE', '/uploads/1020-1.jpg',     18354, '2026-10-11T09:00:00'),
 (1021, 'BEFORE', '/uploads/1021-1.jpg',     16521, '2026-10-21T09:00:00'),
 (1003, 'BEFORE', '/uploads/1003-1.jpg',     18318, '2026-09-20T14:00:00'),
 (1003, 'AFTER',  '/uploads/1003-after.jpg', 18318, '2026-09-23T16:00:00'),
 (987,  'BEFORE', '/uploads/987-1.jpg',      17359, '2026-09-14T09:00:00'),
 (987,  'AFTER',  '/uploads/987-after.jpg',  17359, '2026-09-16T11:00:00'); 
GO

/* ---------- ประวัติสถานะ ---------- */
INSERT INTO request_status_history (request_id, status, note, changed_by, changed_at) VALUES
 (1024, 'PENDING',     N'ส่งคำร้องพร้อมรูปภาพ 1 รูป', 1, '2026-10-12T10:00:00'),

(1021, 'PENDING',      N'ส่งคำร้องพร้อมรูปภาพ 1 รูป', 2, '2026-10-21T09:00:00'),

 (1019, 'PENDING',     N'ส่งคำร้องพร้อมรูปภาพ 2 รูป', 1, '2026-10-10T08:40:00'),
 (1019, 'IN_PROGRESS', N'รับเรื่องและมอบหมายช่าง ชาญชัย ท่อน้ำดี นัดเข้าซ่อม 30/11/2569 13:00', 4, '2026-10-10T09:15:00'),

 (1020, 'PENDING',     N'ส่งคำร้องพร้อมรูปภาพ 1 รูป', 2, '2026-10-11T09:00:00'),
 (1020, 'IN_PROGRESS', N'รับเรื่องและมอบหมายช่าง ชาญชัย ท่อน้ำดี นัดเข้าซ่อม 30/11/2569 14:30', 4, '2026-10-11T10:30:00'),

 (1003, 'PENDING',     N'ส่งคำร้องพร้อมรูปภาพ 1 รูป', 1, '2026-09-20T14:00:00'),
 (1003, 'IN_PROGRESS', N'รับเรื่องและมอบหมายช่าง เกรียงไกร ลมเย็น นัดเข้าซ่อม 22/09/2569 10:00', 4, '2026-09-21T09:00:00'),
 (1003, 'COMPLETED',   N'ล้างแผ่นกรองและเติมน้ำยาแอร์ ใช้งานได้ปกติ', 9, '2026-09-23T16:00:00'),

 (987,  'PENDING',     N'ส่งคำร้องพร้อมรูปภาพ 1 รูป', 2, '2026-09-14T09:00:00'),
 (987,  'IN_PROGRESS', N'รับเรื่องและมอบหมายช่าง บรรพต ไม้งาม นัดเข้าซ่อม 16/09/2569 10:00', 4, '2026-09-14T13:00:00'),
 (987,  'COMPLETED',   N'เปลี่ยนบานพับใหม่ 2 ตัว', 11, '2026-09-16T11:00:00');
GO

/* ---------- เช็กผล ---------- */
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'repair_requests',        COUNT(*) FROM repair_requests
UNION ALL SELECT 'request_images',         COUNT(*) FROM request_images
UNION ALL SELECT 'request_status_history', COUNT(*) FROM request_status_history;
GO