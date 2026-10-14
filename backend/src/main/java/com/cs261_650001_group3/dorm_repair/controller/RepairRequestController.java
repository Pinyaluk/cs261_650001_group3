package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.dto.CreateRepairRequestDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    public RepairRequestController(RepairRequestService repairRequestService) {
        this.repairRequestService = repairRequestService;
    }

    // U3: รายการคำร้องของผู้ใช้ที่ login (ดึงจาก DB)
    // TODO: เมื่อ Login ของ BE4 เสร็จ เปลี่ยนจาก X-User-Id เป็น userId จาก token
    //       ตอนนี้ถ้าไม่ส่ง header มา = ผู้ใช้ 1 (resident01 สมชาย)
    @GetMapping("/my")
    public List<RepairRequestSummaryDTO> getMyRequests(
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {
        return repairRequestService.getMyRequests(userId);
    }

    // U1: API สำหรับสร้างใบแจ้งซ่อม (POST) จาก feature/u1-repair-request-api
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED) // บังคับให้ตอบกลับเป็น HTTP 201 Created ตาม Spec
    public RepairRequestResponseDTO createRepairRequest(
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
            @ModelAttribute CreateRepairRequestDTO dto, // ใช้ @ModelAttribute เพื่อรับค่าฟอร์มแยกช่องจาก Postman
            @RequestParam("images") List<MultipartFile> images) {
        
        // ส่งต่อไปให้ Service บันทึกลงฐานข้อมูลและจัดการรูปภาพ
        return repairRequestService.createRequest(dto, images, userId);
    }
    // U3: รายละเอียดคำร้อง รูป และประวัติสถานะ (ดึงจาก DB) ไม่ใช่ของตัวเอง → 404
    @GetMapping("/{id}")
    public RepairRequestResponseDTO getById(
            @PathVariable("id") Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {
        return repairRequestService.getRequestDetail(id, userId);
    }
}
