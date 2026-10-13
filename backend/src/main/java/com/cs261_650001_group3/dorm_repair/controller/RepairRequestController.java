package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.dto.ContactDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}