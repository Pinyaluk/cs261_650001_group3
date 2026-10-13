package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDateTime;
import java.util.List;

public record RepairRequestResponseDTO(
        Long requestId,
        String title,
        String category,
        String description,
        LocalDateTime appointmentDateTime,
        String status,
        List<String> imageUrls,
        List<StatusHistoryDTO> statusHistory,
        LocalDateTime createdAt
) {}