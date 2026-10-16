package com.cs261_650001_group3.dorm_repair.service;

import com.cs261_650001_group3.dorm_repair.dto.LoginResponseDTO;
import com.cs261_650001_group3.dorm_repair.entity.User;
import com.cs261_650001_group3.dorm_repair.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * U2 Login/Logout แบบ token ง่ายๆ
 * login สำเร็จได้ token (UUID) เก็บคู่กับ userId ไว้ในหน่วยความจำ
 * ทุก API ที่ต้องรู้ว่าใครเรียก ให้ส่ง header  Authorization: Bearer <token>
 * (ปิด backend แล้ว token หายหมด ต้อง login ใหม่ ใช้ได้สำหรับ Sprint 1)
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Map<String, Long> tokens = new ConcurrentHashMap<>();

    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** รหัสถูก → คืน token และข้อมูลผู้ใช้ / ผิด → 401 */
    public LoginResponseDTO login(String username, String password) {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
        }
        User user = userRepository.findByUsername(username)
                .filter(u -> passwordEncoder.matches(password, u.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"));

        String token = UUID.randomUUID().toString();
        tokens.put(token, user.getUserId());
        return new LoginResponseDTO(token, user.getUserId(), user.getFullName(), user.getRole().name());
    }

    public void logout(String authHeader) {
        String token = extractToken(authHeader);
        if (token != null) {
            tokens.remove(token);
        }
    }

    /** ใช้ใน Controller อื่น: แปลง header Authorization เป็น userId ถ้าไม่มีหรือหมดอายุ → 401 */
    public Long requireUserId(String authHeader) {
        String token = extractToken(authHeader);
        Long userId = (token == null) ? null : tokens.get(token);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "กรุณาเข้าสู่ระบบใหม่");
        }
        return userId;
    }

    private static String extractToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        return authHeader.substring(7).trim();
    }
}
