package com.cs261_650001_group3.dorm_repair.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.cs261_650001_group3.dorm_repair.dto.TechnicianAvailabilityDTO;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.service.AuthService;
import com.cs261_650001_group3.dorm_repair.service.TechnicianAssignmentService;

/**
 * U6 (Task46): รายชื่อช่างสำหรับหน้ามอบหมายงาน ตาม API spec Sprint 2 ข้อ 2.5
 * ต้องส่ง header  Authorization: Bearer <token>
 */
@RestController
@RequestMapping("/api/staff/technicians")
public class StaffTechnicianController {

    private final TechnicianAssignmentService assignmentService;
    private final AuthService authService;

    public StaffTechnicianController(TechnicianAssignmentService assignmentService, AuthService authService) {
        this.assignmentService = assignmentService;
        this.authService = authService;
    }

    /**
     * GET /api/staff/technicians?category=PLUMBING&date=2026-11-30&slot=AFTERNOON
     * ไม่มี token → 401 / ไม่ใช่ STAFF → 403
     * category/slot ไม่ถูกต้อง, date ผิดรูปแบบ หรือส่ง date กับ slot ไม่ครบคู่ → 400
     */
    @GetMapping
    public List<TechnicianAvailabilityDTO> getTechnicians(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(value = "slot", required = false) String slot) {
        authService.requireRole(authHeader, Role.STAFF);
        return assignmentService.getTechnicians(category, date, slot);
    }
}
