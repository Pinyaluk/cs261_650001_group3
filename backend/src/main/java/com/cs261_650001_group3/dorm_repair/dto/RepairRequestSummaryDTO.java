package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDateTime;

public record RepairRequestSummaryDTO(
        Long requestId,
        String title,
        String category,
        String status,
        String technicianName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}