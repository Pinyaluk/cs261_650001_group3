package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record RepairRequestResponseDTO(
        Long requestId,
        String locationType,
        String building,
        String locationDetail,
        String category,
        String title,
        String description,
        LocalDate preferredDate1,
        String preferredSlot1,
        LocalDate preferredDate2,
        String preferredSlot2,
        LocalDateTime appointmentDateTime,
        String contactPhone,
        String lineId,
        String status,
        String urgency,
        ContactDTO technician,
        List<String> imageUrls,
        List<StatusHistoryDTO> statusHistory,
        LocalDateTime createdAt
) {}