package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.dto.ContactDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/repair-requests")
public class RepairRequestController {

    
    @GetMapping("/my")
    public List<RepairRequestSummaryDTO> getMyRequests() {
        return List.of(
                new RepairRequestSummaryDTO(1024L, "ไฟห้องน้ำดับ", "ELECTRICAL", "PENDING", null,
                        LocalDateTime.of(2026, 10, 12, 10, 0), LocalDateTime.of(2026, 10, 12, 10, 0)),
                new RepairRequestSummaryDTO(1019L, "ก๊อกน้ำอ่างล้างหน้ารั่ว", "PLUMBING", "IN_PROGRESS", "วิชัย สายลม",
                        LocalDateTime.of(2026, 10, 10, 8, 40), LocalDateTime.of(2026, 10, 10, 9, 15)),
                new RepairRequestSummaryDTO(1003L, "แอร์ไม่เย็น", "AIR_CONDITIONER", "COMPLETED", "วิชัย สายลม",
                        LocalDateTime.of(2026, 9, 20, 14, 0), LocalDateTime.of(2026, 9, 23, 16, 0)),
                new RepairRequestSummaryDTO(987L, "บานพับตู้เสื้อผ้าหลุด", "FURNITURE", "COMPLETED", "วิชัย สายลม",
                        LocalDateTime.of(2026, 9, 14, 9, 0), LocalDateTime.of(2026, 9, 16, 11, 0))
        );
    }

    
    @GetMapping("/{id}")
    public RepairRequestResponseDTO getById(@PathVariable("id") Long id) {
        if (id == 1019L) {
            return new RepairRequestResponseDTO(
                    1019L, "ROOM", "อาคาร A", "ชั้น 3 · ห้อง 305",
                    "PLUMBING", "ก๊อกน้ำอ่างล้างหน้ารั่ว",
                    "น้ำหยดจากก๊อกอ่างล้างหน้าตลอดเวลา ปิดสุดแล้วก็ยังไม่หยุด",
                    LocalDate.of(2026, 10, 13), "MORNING",
                    LocalDate.of(2026, 10, 14), "AFTERNOON",
                    LocalDateTime.of(2026, 10, 14, 13, 0),
                    "081-234-5678", "somchai305",
                    "IN_PROGRESS", "URGENT",
                    new ContactDTO("วิชัย สายลม", "089-555-0148"),
                    List.of("/uploads/1019-1.jpg", "/uploads/1019-2.jpg"),
                    List.of(
                            new StatusHistoryDTO("PENDING", "ส่งคำร้องพร้อมรูปภาพ 2 รูป",
                                    LocalDateTime.of(2026, 10, 10, 8, 40), "สมชาย ใจดี"),
                            new StatusHistoryDTO("IN_PROGRESS", "รับเรื่องและมอบหมายช่าง นัดเข้าซ่อม 14/10/2569 13:00",
                                    LocalDateTime.of(2026, 10, 10, 9, 15), "สุดา พรศรี")
                    ),
                    LocalDateTime.of(2026, 10, 10, 8, 40)
            );
        }
        return new RepairRequestResponseDTO(
                id, "ROOM", "อาคาร A", "ชั้น 3 · ห้อง 305",
                "ELECTRICAL", "หลอดไฟห้องน้ำ",
                "หลอดไฟในห้องน้ำไม่ติดตั้งแต่เมื่อวานตอนเย็น",
                LocalDate.of(2026, 10, 13), "MORNING",
                null, null,
                null,
                "081-234-5678", null,
                "PENDING", "NORMAL",
                null,
                List.of("/uploads/1024-1.jpg"),
                List.of(new StatusHistoryDTO("PENDING", "ส่งคำร้องพร้อมรูปภาพ 1 รูป",
                        LocalDateTime.of(2026, 10, 12, 10, 0), "สมชาย ใจดี")),
                LocalDateTime.of(2026, 10, 12, 10, 0)
        );
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
}
