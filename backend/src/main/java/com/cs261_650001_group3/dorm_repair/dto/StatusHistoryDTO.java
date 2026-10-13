package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDateTime;

public record StatusHistoryDTO(
        String status,
        LocalDateTime changedAt,
        String changedByName
) {}