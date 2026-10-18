# D20 · Integration Test UI ↔ API (Sprint 1)

สคริปต์รันเคสทดสอบตามเอกสาร "Integration Test Design – UI ↔ API (Sprint 1)" ครบ 30 เคส
(IT-U2-01..06, IT-U1-01..10, IT-U3-01..09, IT-X-01..05) ด้วยเบราว์เซอร์จริง
ตรวจทั้งสิ่งที่ผู้ใช้เห็นบนหน้าจอและ request/response ที่หน้าเว็บส่งไป backend

## สิ่งที่ต้องมี

- ระบบรันอยู่แล้วด้วย `docker compose up --build` (หน้าเว็บ `localhost:3000`, backend `localhost:8080`)
- Node.js 18 ขึ้นไป
- Google Chrome หรือ Microsoft Edge (สคริปต์ใช้เบราว์เซอร์ที่มีในเครื่อง ไม่ต้องโหลดเพิ่ม)

## วิธีรัน

```powershell
cd tests/d20-ui-api
npm install
node run-d20.mjs
```

- `node run-d20.mjs --headed` เปิดหน้าต่างเบราว์เซอร์ให้ดูขณะรัน
- `node run-d20.mjs --skip-backend-stop` ข้ามเคส IT-U1-10 (เคสนี้สั่ง `docker compose stop backend` แล้วเปิดกลับให้เอง)

ถ้าฐานข้อมูลมีคำร้องที่สร้างไว้ก่อนแล้ว เคสยังรันได้ สคริปต์เทียบกับข้อมูลที่ API ส่งมาจริง
ถ้าอยากได้ตัวเลขตรงกับเอกสารทุกตัว ให้เริ่มจากฐานข้อมูลใหม่ด้วย `docker compose down -v` แล้ว `docker compose up --build`

## ผลลัพธ์

แต่ละรอบเก็บแยกโฟลเดอร์ `results/<วันที่_เวลา>/` (โฟลเดอร์ results ไม่ขึ้น Git ให้แนบรูปหลักฐานในการ์ด Trello แทน)

- `d20-results.md` สรุปผลรายเคส (ผ่าน / ไม่ผ่าน / รันไม่ได้) และรายละเอียดที่ตรวจ
- `d20-results.json` ผลแบบเครื่องอ่านได้
- `IT-xx-xx.png` รูปหลักฐานรายเคส: หน้าเว็บ + ตาราง request ไป backend + ผลการตรวจ
- `raw/` ภาพหน้าเว็บอย่างเดียว

ไฟล์รูปทดสอบ (ok1–ok4.jpg, mid.jpg 3 MB, big.jpg 5.5 MB, doc.pdf) สร้างใหม่ทุกรอบใน `results/fixtures/`
