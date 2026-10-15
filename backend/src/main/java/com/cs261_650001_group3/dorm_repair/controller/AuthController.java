package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.entity.User;
import com.cs261_650001_group3.dorm_repair.service.AuthService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request, HttpSession session) {
        String username = request.get("username");
        String password = request.get("password");

        User user = authService.authenticate(username, password);
        if (user != null) {
            session.setAttribute("currentUser", user);
            return ResponseEntity.ok(Map.of("message", "Login successful", "user", user));
        }
        return ResponseEntity.status(401).body(Map.of("error", "Invalid username or password"));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok(Map.of("message", "Logout successful"));
    }
}