package com.cs261_650001_group3.dorm_repair.controller;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;

@RestController
@RequestMapping("/api/repair-requests")
public class RepairRequestController {

    // TODO: เปลี่ยนไปเรียก RepairRequestService เมื่อ DAO ของ BE2 merge เข้า develop แล้ว
    @GetMapping("/my")
    public List<RepairRequestSummaryDTO> getMyRequests() {
        return List.of(
                new RepairRequestSummaryDTO(1024L, "ไฟห้องน้ำดับ", "ELECTRICAL", "PENDING",
                        LocalDateTime.of(2026, 10, 9, 18, 20)),
                new RepairRequestSummaryDTO(1019L, "ก๊อกน้ำอ่างล้างหน้ารั่ว", "PLUMBING", "IN_PROGRESS",
                        LocalDateTime.of(2026, 10, 2, 9, 15)),
                new RepairRequestSummaryDTO(1003L, "แอร์ไม่เย็น", "AIR_CONDITIONER", "COMPLETED",
                        LocalDateTime.of(2026, 9, 21, 14, 0))
        );
    }

    // TODO: เปลี่ยนไปเรียก RepairRequestService เมื่อ DAO ของ BE2 merge เข้า develop แล้ว
    @GetMapping("/{id}")
    public RepairRequestResponseDTO getById(@PathVariable("id") Long id) {
        return new RepairRequestResponseDTO(
                id,
                "ไฟห้องน้ำดับ",
                "ELECTRICAL",
                "หลอดไฟในห้องน้ำไม่ติดตั้งแต่เมื่อวานตอนเย็น",
                LocalDateTime.of(2026, 10, 12, 10, 0),
                "PENDING",
                List.of("/uploads/1024-1.jpg", "/uploads/1024-2.jpg"),
                List.of(new StatusHistoryDTO("PENDING",
                        LocalDateTime.of(2026, 10, 9, 18, 20), "สมชาย ใจดี")),
                LocalDateTime.of(2026, 10, 9, 18, 20)
        );
    }
    
     //API สำหรับสร้างใบแจ้งซ่อม (POST)
    
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
}

