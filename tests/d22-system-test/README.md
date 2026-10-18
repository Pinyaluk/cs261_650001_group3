# D22 · System Test (Sprint 1)

สคริปต์รันเคสตามเอกสาร "System Test · Sprint 1 ระบบแจ้งซ่อมหอพัก" ครบ 30 เคส
(ST-U1-01..12, ST-U2-01..07, ST-U3-01..10 และ ST-E2E-01 ที่มี 7 ขั้น)
ทดสอบแบบ black-box ผ่านหน้าเว็บเหมือนผู้ใช้จริง เช็กข้อความที่มองเห็นบนจอ
แล้วเช็กข้อมูลในฐานข้อมูลจริงด้วย `sqlcmd` ใน container `db`

## สิ่งที่ต้องมี

- Docker Desktop เปิดอยู่ และระบบรันด้วย `docker compose up -d`
- Node.js 18 ขึ้นไป
- Google Chrome หรือ Microsoft Edge

## วิธีรัน

ควรเริ่มจากฐานข้อมูลตั้งต้น เพราะเคสในเอกสารอิงจำนวนคำร้องตั้งต้น (resident01 มี 3, resident02 มี 1, resident03 ไม่มี)

```powershell
docker compose down -v
docker compose up -d
cd tests/d22-system-test
npm.cmd install
node run-d22.mjs
```

- `node run-d22.mjs --headed` เปิดหน้าต่างเบราว์เซอร์ให้ดูขณะรัน
- ถ้าฐานข้อมูลไม่ใช่สภาพตั้งต้น สคริปต์ยังรันได้ โดยเทียบกับข้อมูลใน DB จริง และบอกไว้ในผล
- ST-U3-03 จะ `UPDATE` สถานะของคำร้องที่ ST-U1-01 สร้าง ไม่แตะข้อมูลตั้งต้น

## ผลลัพธ์

แต่ละรอบเก็บแยกโฟลเดอร์ `results/<วันที่_เวลา>/` (ไม่ขึ้น Git ให้แนบรูปหลักฐานในการ์ด Trello)

- `d22-results.md` สรุปผลตาม Story และรายละเอียดที่ตรวจทุกเคส
- `d22-results.json` ผลแบบเครื่องอ่านได้
- `ST-xx-xx.png` รูปหลักฐาน: หน้าเว็บ + request ไป backend + คำสั่ง SQL ที่ใช้ตรวจ + ผลการตรวจ
- `raw/` ภาพหน้าเว็บอย่างเดียว
