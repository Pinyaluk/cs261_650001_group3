package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** U6 (Task46): Response ของ PUT /api/staff/repair-requests/{id}/assign ตาม API spec Sprint 2 ข้อ 2.4 */
public record AssignTechnicianResponseDTO(
        Long requestId,
        String status,
        String urgency,
        Long technicianId,
        LocalDate appointmentDate,
        String appointmentSlot,
        String appointmentNote,
        LocalDateTime updatedAt
) {}
