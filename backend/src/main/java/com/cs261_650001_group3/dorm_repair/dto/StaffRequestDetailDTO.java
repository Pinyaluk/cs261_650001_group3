package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * U4 (และหน้ารายละเอียดงานของช่าง U7): รายละเอียดคำร้อง 1 ใบ ตาม API spec Sprint 2 ข้อ 2.3
 * appointmentDate/Slot แยกมาจาก appointment_datetime (ก่อน 13:00 = MORNING)
 * repairResult/completedAt มาจากประวัติสถานะ COMPLETED (ยังไม่เสร็จ = null)
 */
public record StaffRequestDetailDTO(
        Long requestId,
        String title,
        String category,
        String locationType,
        String building,
        String locationDetail,
        String reporterName,
        String reporterPhone,
        String lineId,
        String description,
        LocalDate preferredDate1,
        String preferredSlot1,
        LocalDate preferredDate2,
        String preferredSlot2,
        String urgency,
        String status,
        ContactDTO technician,
        LocalDate appointmentDate,
        String appointmentSlot,
        String appointmentNote,
        String repairResult,
        LocalDateTime completedAt,
        List<String> imageUrls,
        List<String> afterImageUrls,
        List<StatusHistoryDTO> statusHistory,
        LocalDateTime createdAt
) {}
