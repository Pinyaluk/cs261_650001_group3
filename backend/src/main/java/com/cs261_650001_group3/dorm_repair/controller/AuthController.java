package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.dto.LoginResponseDTO;
import com.cs261_650001_group3.dorm_repair.service.AuthService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** POST /api/auth/login  { username, password } → 200 { token, userId, fullName, role } / 401 */
    @PostMapping("/login")
    public LoginResponseDTO login(@RequestBody Map<String, String> body) {
        return authService.login(body.get("username"), body.get("password"));
    }

    /** POST /api/auth/logout  header Authorization: Bearer <token> → 200 */
    @PostMapping("/logout")
    public Map<String, String> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        authService.logout(authHeader);
        return Map.of("message", "ออกจากระบบแล้ว");
    }
}
