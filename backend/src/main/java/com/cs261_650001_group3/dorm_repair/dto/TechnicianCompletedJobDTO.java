package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * U7: รายการงานที่เสร็จแล้วของช่าง แบบแบ่งหน้า (API 2.6)
 * GET /api/technician/repair-requests/completed
 */
public record TechnicianCompletedJobDTO(
        Long requestId,
        String title,
        String category,
        String locationType,
        String building,
        String locationDetail,
        LocalDate appointmentDate,
        String appointmentSlot,
        LocalDateTime completedAt
) {}
