# API Spec — U9 เปลี่ยนรหัสผ่าน (Sprint 2)

ระบบแจ้งซ่อมภายในหอพัก · CS261 กลุ่ม 3 section 650001

| รายการ | ค่า |
|---|---|
| User Story | U9 ผู้ใช้เปลี่ยนรหัสผ่าน (สิ่งที่ทำเพิ่ม T2) |
| Task | Task39 Design |
| Endpoint | `PUT /api/users/me/password` |
| ใครเรียกได้ | ผู้ใช้ที่ login อยู่ทุกบทบาท (`RESIDENT` / `STAFF` / `TECHNICIAN`) |
| หน้าที่เรียก | หน้า "ตั้งค่าบัญชี" (ชื่อไฟล์ที่วางไว้ `pages/account-settings.html` + `js/account-settings.js`) |

ข้อตกลงทั่วไป (token, รูปแบบ error, ค่า enum) ใช้ตาม `docs/api-spec-sprint1.md` หัวข้อ 1 เอกสารนี้จะย้ายไปรวมใน `docs/api-spec-sprint2.md` เมื่อ Task32 เสร็จ

---

## 1. `PUT /api/users/me/password`

ผู้ใช้เปลี่ยนรหัสผ่านของตัวเอง โดยต้องกรอกรหัสผ่านปัจจุบันให้ถูก เปลี่ยนสำเร็จแล้ว token ทุกตัวของผู้ใช้คนนี้ถูกยกเลิก ต้อง login ใหม่ด้วยรหัสใหม่

`me` หมายถึงผู้ใช้เจ้าของ token ระบบหา `userId` จาก token เท่านั้น ไม่รับ `userId` จาก URL หรือ body จึงเปลี่ยนรหัสของคนอื่นไม่ได้

### 1.1 Request

**Header**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body** — `ChangePasswordRequestDTO`
```json
{
  "currentPassword": "password123",
  "newPassword": "newpass2026",
  "confirmNewPassword": "newpass2026"
}
```

| ฟิลด์ | ชนิด | บังคับ | เงื่อนไข |
|---|---|---|---|
| `currentPassword` | string | ✓ | ต้องตรงกับรหัสผ่านปัจจุบันในระบบ |
| `newPassword` | string | ✓ | ยาวอย่างน้อย 8 ตัวอักษร และต้องไม่ซ้ำ `currentPassword` |
| `confirmNewPassword` | string | ✓ | ต้องตรงกับ `newPassword` ทุกตัวอักษร |

ช่องที่มีแต่ช่องว่าง (เช่น `"   "`) ถือว่าว่าง

`confirmNewPassword` ตรวจซ้ำที่ backend ด้วย แม้หน้าเว็บจะตรวจก่อนส่งแล้ว เพื่อให้ API ถูกต้องเองเมื่อเรียกจาก Postman

### 1.2 Response 200
```json
{ "message": "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่" }
```

หลังได้ 200 หน้าเว็บแสดงหน้า "เปลี่ยนรหัสผ่านสำเร็จ" แล้วล้าง `localStorage` และพาไป `login.html` (ไม่ต้องเรียก `/api/auth/logout` เพราะ token ถูกยกเลิกแล้ว)

### 1.3 Error

ตรวจตามลำดับในตาราง เจอข้อแรกที่ผิดก็ตอบทันที

| ลำดับ | Status | กรณี | message |
|---|---|---|---|
| 1 | 401 | ไม่ส่ง token / token ใช้ไม่ได้ | `กรุณาเข้าสู่ระบบใหม่` |
| 2 | 400 | ช่องใดช่องหนึ่งว่าง | `กรุณากรอกข้อมูลให้ครบทุกช่อง` |
| 3 | 400 | `newPassword` สั้นกว่า 8 ตัวอักษร | `รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร` |
| 4 | 400 | `confirmNewPassword` ไม่ตรงกับ `newPassword` | `ยืนยันรหัสผ่านไม่ตรงกัน` |
| 5 | 400 | `currentPassword` ไม่ตรงกับรหัสในระบบ | `รหัสผ่านปัจจุบันไม่ถูกต้อง` |
| 6 | 400 | `newPassword` ซ้ำ `currentPassword` | `รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม` |

รูปแบบ body ของ error เหมือนทุก API (`{ timestamp, status, error, message, path }`) หน้าเว็บแสดง `message` ใต้ฟอร์ม

**ทำไมรหัสผ่านปัจจุบันผิดถึงตอบ 400 ไม่ใช่ 401:** `apiFetch()` ใน `js/api-client.js` เจอ 401 จาก API ใดก็ตาม (ยกเว้น login) จะล้างข้อมูลแล้วพาไปหน้า login ทันที ถ้าตอบ 401 ผู้ใช้ที่พิมพ์รหัสเดิมผิดจะถูกพาออกจากระบบโดยไม่เห็นข้อความเตือน จึงใช้ 401 เฉพาะกรณี token ใช้ไม่ได้

**ทำไมตรวจข้อ 2–4 ก่อนข้อ 5:** ข้อ 2–4 ตรวจได้จาก body อย่างเดียว ไม่ต้องอ่านฐานข้อมูลหรือคำนวณ BCrypt ส่วนข้อ 6 ต้องอยู่หลังข้อ 5 เพราะเทียบ `newPassword` กับ `currentPassword` ได้ก็ต่อเมื่อรู้แล้วว่า `currentPassword` คือรหัสจริง

---

## 2. การทำงานฝั่ง Backend

### 2.1 ไฟล์ที่เพิ่ม / แก้
| ไฟล์ | สิ่งที่ทำ |
|---|---|
| `dto/ChangePasswordRequestDTO.java` | ใหม่ `record ChangePasswordRequestDTO(String currentPassword, String newPassword, String confirmNewPassword)` |
| `controller/UserController.java` | ใหม่ `@RequestMapping("/api/users")` มี `@PutMapping("/me/password")` |
| `service/AuthService.java` | เพิ่ม `changePassword(Long userId, ChangePasswordRequestDTO dto)` และ `revokeAllTokens(Long userId)` |
| `database/init.sql` | ไม่ต้องแก้ ใช้คอลัมน์ `users.password_hash` เดิม |

### 2.2 ขั้นตอนใน `AuthService.changePassword`
1. Controller เรียก `authService.requireUserId(authHeader)` ได้ `userId` (ไม่ผ่าน → 401)
2. ตรวจช่องว่าง → ความยาว `newPassword` ≥ 8 → `confirmNewPassword` ตรงกัน (ไม่ผ่าน → 400)
3. `userRepository.findById(userId)` แล้ว `passwordEncoder.matches(currentPassword, user.getPasswordHash())` (ไม่ตรง → 400)
4. `newPassword.equals(currentPassword)` (ซ้ำ → 400)
5. `user.setPasswordHash(passwordEncoder.encode(newPassword))` แล้ว `userRepository.save(user)`
6. ลบ token ทุกตัวของผู้ใช้คนนี้ `tokens.values().removeIf(id -> id.equals(userId))` เครื่องอื่นที่ login ค้างไว้จะหลุดด้วย

ใช้ `BCryptPasswordEncoder` ตัวเดียวกับที่ `login` ใช้ตรวจรหัส ค่าที่บันทึกจึงขึ้นต้นด้วย `$2a$10$` เหมือนข้อมูลใน `init.sql` และ login ด้วยรหัสใหม่ได้ทันที

### 2.3 SQL
```sql
SELECT * FROM users WHERE user_id = ?
UPDATE users SET password_hash = ? WHERE user_id = ?
```

---

## 3. การทำงานฝั่ง Frontend

- เพิ่มฟังก์ชันใน `js/api-client.js`
  ```js
  /** สำเร็จ → { message } / ไม่สำเร็จ → throw ApiError (อ่าน err.message ไปแสดง) */
  async function changePassword(currentPassword, newPassword, confirmNewPassword) {
    return apiFetch("/api/users/me/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
    });
  }
  ```
- หน้าเว็บตรวจข้อ 2–4 ก่อนส่ง เพื่อเตือนได้ทันทีโดยไม่ต้องรอ API ข้อความเตือนใช้ชุดเดียวกับตาราง 1.3
- ลิงก์ "ตั้งค่าบัญชี" อยู่ในแถบหัว (sticky) ของทุกบทบาท

---

## 4. ตัวอย่างทดสอบด้วย Postman

ใช้บัญชีตัวอย่างใน `init.sql` (รหัสเริ่มต้นทุกบัญชีคือ `password123`)

| # | ขั้นตอน | Body | ผลที่คาดหวัง |
|---|---|---|---|
| 1 | ไม่ส่ง token | ถูกต้องทุกช่อง | 401 |
| 2 | login `resident03` แล้วส่ง | `currentPassword` = `wrongpass1` | 400 `รหัสผ่านปัจจุบันไม่ถูกต้อง` |
| 3 | | `newPassword` = `abc1234` (7 ตัว) | 400 `รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร` |
| 4 | | `confirmNewPassword` ไม่ตรง | 400 `ยืนยันรหัสผ่านไม่ตรงกัน` |
| 5 | | `newPassword` = `password123` | 400 `รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม` |
| 6 | | `password123` → `newpass2026` | 200 |
| 7 | ใช้ token เดิมเรียก `GET /api/repair-requests/my` | | 401 (token ถูกยกเลิกแล้ว) |
| 8 | login `resident03` ด้วย `password123` | | 401 |
| 9 | login `resident03` ด้วย `newpass2026` | | 200 |

หลังทดสอบเสร็จ ให้เปลี่ยนรหัสกลับเป็น `password123` หรือรัน `docker compose down -v` แล้ว `up` ใหม่ เพื่อให้ข้อมูลตัวอย่างกลับเป็นค่าเริ่มต้น
