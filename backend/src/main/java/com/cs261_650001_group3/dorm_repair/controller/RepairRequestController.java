package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

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
}
