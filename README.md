# 🛠️ ระบบแจ้งซ่อมภายในหอพัก (Dorm Repair Request System)

โครงงานรายวิชา **CS261 Software Engineering** — กลุ่มที่ 3, Section 650001 (ภาคพิเศษ)

ระบบเว็บสำหรับให้ผู้พักอาศัยแจ้งซ่อมออนไลน์ แนบรูปภาพ นัดหมายเวลา และติดตามสถานะคำร้องได้ ส่วนเจ้าหน้าที่ใช้ตรวจสอบและมอบหมายงานให้ช่างซ่อม

---

## 📌 สารบัญ
- [ฟีเจอร์หลัก](#-ฟีเจอร์หลัก)
- [บทบาทผู้ใช้](#-บทบาทผู้ใช้)
- [เทคโนโลยีที่ใช้](#-เทคโนโลยีที่ใช้)
- [โครงสร้างโปรเจกต์](#-โครงสร้างโปรเจกต์)
- [การติดตั้งและรันโปรเจกต์](#-การติดตั้งและรันโปรเจกต์)
- [การทำงานกับ Git (Git Flow)](#-การทำงานกับ-git-git-flow)
- [แผนการพัฒนา (Sprint)](#-แผนการพัฒนา-sprint)
- [สมาชิกในทีม](#-สมาชิกในทีม)

---

## ✨ ฟีเจอร์หลัก
- ส่งคำร้องแจ้งซ่อม พร้อมแนบรูปภาพ (ไม่เกิน 3 ภาพ, ภาพละไม่เกิน 5MB) และนัดหมายวันเวลาเข้าซ่อม
- เข้าสู่ระบบ / ออกจากระบบ โดยแต่ละบทบาทจะเห็นหน้าจอต่างกัน
- ตรวจสอบประวัติและสถานะคำร้อง
- เจ้าหน้าที่ตรวจสอบคำร้องและมอบหมายงานให้ช่างซ่อม

### สถานะคำร้อง
| สถานะ (ในระบบ) | ความหมาย |
|---|---|
| `PENDING` | รอรับเรื่อง |
| `IN_PROGRESS` | กำลังดำเนินการ |
| `COMPLETED` | เสร็จสิ้น |

---

## 👥 บทบาทผู้ใช้
| บทบาท | สิทธิ์การใช้งาน |
|---|---|
| **ผู้พักอาศัย** | ส่งคำร้องแจ้งซ่อม, ติดตามสถานะ, ดูประวัติคำร้อง |
| **เจ้าหน้าที่** | ตรวจสอบคำร้อง, มอบหมายงานให้ช่าง (รวมสิทธิ์ผู้ดูแลระบบและหัวหน้าหอพัก) |
| **ช่างซ่อม** | ดูงานที่ได้รับมอบหมาย, อัปเดตสถานะงาน |

---

## 🧰 เทคโนโลยีที่ใช้
| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | HTML, CSS, JavaScript (Node.js project) |
| Backend | Java 21 (Temurin), Spring Boot 4.1.1, Maven |
| Database | Microsoft SQL Server |
| DevOps | Docker, Docker Compose (3 services: database / backend / frontend) |
| การจัดการงาน | Scrum + Trello |

---

## 📁 โครงสร้างโปรเจกต์
```
Project_Cs261/
├── backend/              # Spring Boot application (Maven)
│   ├── src/
│   ├── pom.xml
│   └── Dockerfile
├── frontend/             # หน้าเว็บ HTML / CSS / JavaScript
│   └── js/
├── docker-compose.yml    # รัน database + backend + frontend พร้อมกัน
├── .gitignore
└── README.md
```

---

## 🚀 การติดตั้งและรันโปรเจกต์

### สิ่งที่ต้องติดตั้งก่อน
- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- (ถ้าจะรันโดยไม่ใช้ Docker) [JDK 21 – Temurin](https://adoptium.net/) และ [Node.js](https://nodejs.org/)

### 1. Clone โปรเจกต์
```bash
git clone https://github.com/Pinyaluk/Project_Cs261.git
cd Project_Cs261
git checkout develop
```

### 2. รันทั้งระบบด้วย Docker Compose
```bash
docker compose up --build
```
หยุดระบบ:
```bash
docker compose down
```

| Service | URL / Port |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| SQL Server | localhost:1433 |

> ⚠️ ตรวจสอบพอร์ตให้ตรงกับที่ตั้งไว้ใน `docker-compose.yml` อีกครั้ง

### 3. รันแยกทีละส่วน (ไม่ใช้ Docker)
**Backend**
```bash
cd backend
./mvnw spring-boot:run        # macOS / Linux
.\mvnw.cmd spring-boot:run    # Windows (PowerShell)
```

**Frontend**
```bash
cd frontend
npm install
npm start
```

---

## 🌿 การทำงานกับ Git (Git Flow)

| Branch | ใช้ทำอะไร |
|---|---|
| `main` | โค้ดที่พร้อมส่ง/นำเสนอ ติด tag ทุก release (เช่น `v1.0.0`) |
| `develop` | รวมงานของทุกคนก่อนออก release |
| `feature/<ชื่องาน>` | งานแต่ละชิ้น แตกออกจาก `develop` (เช่น `feature/login`, `feature/docker-setup`) |
| `release/<เวอร์ชัน>` | เตรียมออก release ก่อน merge เข้า `main` |

### ขั้นตอนทำงานแต่ละครั้ง
```bash
# 1. อัปเดต develop ให้เป็นล่าสุด
git checkout develop
git pull origin develop

# 2. แตก branch ใหม่สำหรับงานของตัวเอง
git checkout -b feature/<ชื่องาน>

# 3. ทำงาน แล้ว commit
git add .
git commit -m "feat: อธิบายสิ่งที่ทำ"

# 4. push ขึ้น GitHub แล้วเปิด Pull Request เข้า develop
git push -u origin feature/<ชื่องาน>
```

### ข้อตกลงของทีม
- ❌ ห้าม push ตรงเข้า `main` หรือ `develop` — ให้เปิด Pull Request เสมอ
- ✅ `git pull` ก่อนเริ่มงานทุกครั้ง เพื่อลด conflict
- ✅ ข้อความ commit ขึ้นต้นด้วย `feat:`, `fix:`, `docs:`, `chore:` ตามประเภทงาน

---

## 📅 แผนการพัฒนา (Sprint)

| ช่วง | รายละเอียด | กำหนดส่ง |
|---|---|---|
| **Sprint 1 → Release 1** | U1 ส่งคำร้องแจ้งซ่อม (แนบรูป, นัดหมายเวลา), เข้าสู่ระบบ, U3 ตรวจสอบประวัติกับสถานะ — เฉพาะบทบาทผู้พักอาศัย | 20 ต.ค. 2569 |
| **Sprint 2 → Release 2** | ตรวจสอบและมอบหมายงานให้ช่าง, ติดตามสถานะคำร้อง | 19 พ.ย. 2569 |

📋 Trello Board: _ใส่ลิงก์ที่นี่_

---

## 🧑‍💻 สมาชิกในทีม
| ชื่อ - นามสกุล | รหัสนักศึกษา | หน้าที่ |
|---|---|---|
| ภิญญลักษณ์ พงษ์เขมภัคค์ | 6809650663 | Scrum Master |
| | | Frontend |
| | | Frontend |
| | | Frontend |
| | | Backend |
| | | Backend |
| | | Backend |
| | | Backend |
