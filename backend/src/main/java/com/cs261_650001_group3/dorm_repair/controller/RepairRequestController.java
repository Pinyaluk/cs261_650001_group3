package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.dto.CreateRepairRequestDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
<<<<<<< HEAD
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
=======
import com.cs261_650001_group3.dorm_repair.service.AuthService;
import com.cs261_650001_group3.dorm_repair.service.RepairRequestService;
>>>>>>> develop
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import com.cs261_650001_group3.dorm_repair.service.RepairRequestService;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;


@RestController
@RequestMapping("/api/repair-requests")
public class RepairRequestController {

    private final RepairRequestService repairRequestService;
    private final AuthService authService;

    public RepairRequestController(RepairRequestService repairRequestService, AuthService authService) {
        this.repairRequestService = repairRequestService;
        this.authService = authService;
    }

   
    @GetMapping("/my")
    public List<RepairRequestSummaryDTO> getMyRequests(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = authService.requireUserId(authHeader);
        return repairRequestService.getMyRequests(userId);
    }

    // U1: API สำหรับสร้างใบแจ้งซ่อม (POST) จาก feature/u1-repair-request-api
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED) // บังคับให้ตอบกลับเป็น HTTP 201 Created ตาม Spec
    public RepairRequestResponseDTO createRepairRequest(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @ModelAttribute CreateRepairRequestDTO dto, // ใช้ @ModelAttribute เพื่อรับค่าฟอร์มแยกช่องจาก Postman
            @RequestParam("images") List<MultipartFile> images) {
        
                Long userId = authService.requireUserId(authHeader);
        // ส่งต่อไปให้ Service บันทึกลงฐานข้อมูลและจัดการรูปภาพ
        return repairRequestService.createRequest(dto, images, userId);
    }
    // U3: รายละเอียดคำร้อง รูป และประวัติสถานะ (ดึงจาก DB) ไม่ใช่ของตัวเอง → 404
    @GetMapping("/{id}")
    public RepairRequestResponseDTO getById(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = authService.requireUserId(authHeader);
        return repairRequestService.getRequestDetail(id, userId);
    }
}