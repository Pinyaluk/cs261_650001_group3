package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDateTime;

/** U4: 1 แถวในตารางรายการคำร้องของเจ้าหน้าที่ (API spec Sprint 2 ข้อ 2.1) */
public record StaffRequestSummaryDTO(
        Long requestId,
        String title,
        String category,
        String locationType,
        String building,
        String locationDetail,
        String reporterName,
        String reporterPhone,
        String status,
        String urgency,
        LocalDateTime createdAt
) {}
