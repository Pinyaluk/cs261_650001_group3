package com.cs261_650001_group3.dorm_repair.dto;

/** ตอบกลับเมื่อ login สำเร็จ ตาม API spec (ห้ามส่ง User entity ตรงๆ เพราะมี passwordHash) */
public record LoginResponseDTO(
        String token,
        Long userId,
        String fullName,
        String role
) {}
