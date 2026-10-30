package com.cs261_650001_group3.dorm_repair.controller;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;

import com.cs261_650001_group3.dorm_repair.dto.CompleteRepairResponseDTO;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.entity.User;
import com.cs261_650001_group3.dorm_repair.service.AuthService;
import com.cs261_650001_group3.dorm_repair.service.RepairCompletionService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * U8 ช่างส่งมอบงาน ตาม API spec Sprint 2 ข้อ 2.7
 * ทุก endpoint ต้องส่ง header  Authorization: Bearer <token>
 */
@RestController
@RequestMapping("/api/technician/repair-requests")
public class TechnicianRepairRequestController {

    private final RepairCompletionService completionService;
    private final AuthService authService;

    public TechnicianRepairRequestController(RepairCompletionService completionService,
                                             AuthService authService) {
        this.completionService = completionService;
        this.authService = authService;
    }

    /**
     * POST /api/technician/repair-requests/{id}/complete  (multipart: repairResult, afterImages 1–3 รูป)
     * ไม่มี token → 401 / ไม่ใช่ TECHNICIAN → 403 / ข้อมูลไม่ถูกต้อง สถานะไม่ใช่ IN_PROGRESS หรือไม่ใช่งานของตน → 400 / ไม่พบ → 404
     */
    @PostMapping(value = "/{id}/complete", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CompleteRepairResponseDTO complete(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "repairResult", required = false) String repairResult,
            @RequestParam(value = "afterImages", required = false) List<MultipartFile> afterImages) {
        User technician = authService.requireRole(authHeader, Role.TECHNICIAN);
        return completionService.complete(id, repairResult, afterImages, technician);
    }

    /**
     * รูปใหญ่เกิน spring.servlet.multipart.max-file-size (5MB) Spring ตัดก่อนถึง Service จึงตอบ 413
     * เปลี่ยนเป็น 400 ตามกติการูปของ U8 (รูปละไม่เกิน 5MB) หน้าที่นี้เฉพาะ endpoint ในคลาสนี้
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleTooLarge(HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("error", HttpStatus.BAD_REQUEST.getReasonPhrase());
        body.put("message", "รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB");
        body.put("path", request.getRequestURI());
        return ResponseEntity.badRequest().body(body);
    }
}
