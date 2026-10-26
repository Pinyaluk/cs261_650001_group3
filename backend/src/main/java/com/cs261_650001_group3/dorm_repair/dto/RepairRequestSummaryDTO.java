package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDateTime;

public record RepairRequestSummaryDTO(
        Long requestId,
        String title,
        String category,
        String status,
        String technicianName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        // เพิ่มสำหรับหน้าประวัติคำร้องแบบตาราง (ตาม Figma จอคอม)
        String urgency,                    // NORMAL / URGENT
        String locationType,               // ROOM / COMMON_AREA
        String building,                   // เช่น อาคาร A
        String locationDetail,             // เช่น ชั้น 3 · ห้อง 305
        LocalDateTime appointmentDateTime  // null จนกว่าเจ้าหน้าที่จะมอบหมายช่าง
) {}