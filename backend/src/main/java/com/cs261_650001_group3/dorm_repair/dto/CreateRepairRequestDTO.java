package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDate;

import com.cs261_650001_group3.dorm_repair.entity.LocationType;
import com.cs261_650001_group3.dorm_repair.entity.RepairCategory;
import com.cs261_650001_group3.dorm_repair.entity.TimeSlot;
import com.cs261_650001_group3.dorm_repair.entity.Urgency;

public record CreateRepairRequestDTO(
        LocationType locationType,
        String building,
        String locationDetail,
        RepairCategory category,
        String title,
        String description,
        LocalDate preferredDate1,
        TimeSlot preferredSlot1,
        LocalDate preferredDate2,
        TimeSlot preferredSlot2,
        String contactPhone,
        String lineId,
        Urgency urgency
) {}