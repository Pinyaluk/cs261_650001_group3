// js/login.js
// หน้าเข้าสู่ระบบ: ตรวจว่ากรอกครบ → เรียก login() → ไปหน้า home.html
// (login() ใน api-client.js เก็บ token ให้เองแล้ว)

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const rememberMe = document.getElementById("remember-me");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");

// .error-msg ถูกซ่อนไว้ใน style.css ต้องเติม class is-visible ตอนมีข้อความ ไม่งั้นผู้ใช้มองไม่เห็น
function setLoginError(message) {
  loginError.textContent = message;
  loginError.classList.toggle("is-visible", message !== "");
}

// ปิดการเตือนของเบราว์เซอร์ (attribute required) ให้ใช้ข้อความของระบบใน #login-error แทน
loginForm.noValidate = true;

// ถ้าเคยติ๊ก "จดจำบัญชี" ไว้ ให้ใส่ชื่อบัญชีรอไว้ให้เลย
const savedUsername = localStorage.getItem("savedUsername");
if (savedUsername) {
  usernameInput.value = savedUsername;
  rememberMe.checked = true;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginError("");

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  // 1) ตรวจว่ากรอกครบไหม
  if (username === "" || password === "") {
    setLoginError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    return;
  }

  // 2) เรียก login() จาก api-client.js
  loginBtn.disabled = true;
  try {
    const result = await login(username, password);

    if (result.success) {
      if (rememberMe.checked) {
        localStorage.setItem("savedUsername", username);
      } else {
        localStorage.removeItem("savedUsername");
      }
     // พาไปหน้าแรกตามบทบาทของผู้ใช้
   window.location.href = homePageFor(result.role);
    } else {
      setLoginError(result.message);
    }
  } finally {
    loginBtn.disabled = false;
  }
});