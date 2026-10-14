// js/login.js
// หน้าเข้าสู่ระบบ: ตรวจว่ากรอกครบ → เรียก login() → ไปหน้า home.html

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const rememberMe = document.getElementById("remember-me");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");

// ถ้าเคยติ๊ก "จดจำบัญชี" ไว้ ให้ใส่ชื่อบัญชีรอไว้ให้เลย
const savedUsername = localStorage.getItem("savedUsername");
if (savedUsername) {
  usernameInput.value = savedUsername;
  rememberMe.checked = true;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); // กันไม่ให้หน้าเว็บรีโหลดเอง
  loginError.textContent = "";

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  // 1) ตรวจว่ากรอกครบไหม
  if (username === "" || password === "") {
    loginError.textContent = "กรุณากรอกชื่อบัญชีผู้ใช้และรหัสผ่าน";
    return;
  }

  // 2) เรียก login() จาก api-client.js
  loginBtn.disabled = true; // กันกดซ้ำ
  try {
    const result = await login(username, password);

    if (result.success) {
      // จำบัญชีตามที่ติ๊ก
      if (rememberMe.checked) {
        localStorage.setItem("savedUsername", username);
      } else {
        localStorage.removeItem("savedUsername");
      }
      // เก็บชื่อกับห้องไว้ให้หน้า home ใช้
      localStorage.setItem("user", JSON.stringify({ name: result.name, room: result.room }));
      window.location.href = "home.html";
    } else {
      loginError.textContent = "ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง";
    }
  } catch (error) {
    loginError.textContent = "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง";
  } finally {
    loginBtn.disabled = false;
  }
});