package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDateTime;
import java.util.List;

/** U8 (Task): Response ของ POST /api/technician/repair-requests/{id}/complete ตาม API spec Sprint 2 ข้อ 2.7 */
public record CompleteRepairResponseDTO(
        Long requestId,
        String status,
        String repairResult,
        List<String> afterImageUrls,
        LocalDateTime completedAt
) {}
