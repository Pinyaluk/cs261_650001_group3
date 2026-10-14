package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import com.cs261_650001_group3.dorm_repair.service.RepairRequestService;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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
    public ResponseEntity<String> createRepairRequest(
            @RequestParam("roomNumber") String roomNumber,
            @RequestParam("description") String description,
            @RequestParam("preferredDate") String preferredDateStr,
            @RequestParam(value = "files", required = false) List<MultipartFile> files) {

        // 1. ตรวจสอบข้อมูลบังคับว่าครบถ้วนไหม
        if (roomNumber == null || roomNumber.trim().isEmpty() ||
            description == null || description.trim().isEmpty() ||
            preferredDateStr == null || preferredDateStr.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Error: กรุณากรอกข้อมูลให้ครบถ้วน (เลขห้อง, รายละเอียด, และวันที่)");
        }

        // 2. ตรวจสอบเงื่อนไขรูปภาพ (จำกัดไม่เกิน 3 รูป และขนาดไม่เกิน 5MB ต่อรูป)
        if (files != null && !files.isEmpty()) {
            if (files.size() > 3) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Error: สามารถแนบรูปภาพได้สูงสุดไม่เกิน 3 รูป");
            }

            long maxFileSize = 5 * 1024 * 1024; // 5 MB
            for (MultipartFile file : files) {
                if (file.getSize() > maxFileSize) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body("Error: ไฟล์รูปภาพ " + file.getOriginalFilename() + " มีขนาดเกิน 5MB");
                }
            }
        }

        // 3. ตรวจสอบวันเวลา (ห้ามเป็นวันในอดีต)
        try {
            LocalDate preferredDate = LocalDate.parse(preferredDateStr);
            LocalDate today = LocalDate.now();
            if (preferredDate.isBefore(today)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Error: ไม่สามารถเลือกวันที่ในอดีตได้");
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Error: รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)");
        }

        String defaultStatus = "รอรับเรื่อง";

        // TODO: เมื่อทำ DAO เสร็จ ค่อยมาเรียก service บันทึกลงฐานข้อมูลตรงนี้

        return ResponseEntity.status(HttpStatus.OK)
                .body("สร้างใบแจ้งซ่อมสำเร็จ! สถานะระบบ: [" + defaultStatus + "]");
    }
    // U3: รายละเอียดคำร้อง รูป และประวัติสถานะ (ดึงจาก DB) ไม่ใช่ของตัวเอง → 404
    @GetMapping("/{id}")
    public RepairRequestResponseDTO getById(
            @PathVariable("id") Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {
        return repairRequestService.getRequestDetail(id, userId);
    }
}
