package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDate;

/**
 * U7: รายการงานที่ได้รับมอบหมายของช่าง (API 2.2)
 * GET /api/technician/repair-requests/assigned
 */
public record TechnicianAssignedJobDTO(
        Long requestId,
        String title,
        String category,
        String locationType,
        String building,
        String locationDetail,
        String reporterName,
        String reporterPhone,
        String urgency,
        LocalDate appointmentDate,
        String appointmentSlot,
        String appointmentNote
) {}
