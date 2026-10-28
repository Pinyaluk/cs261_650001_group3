package com.cs261_650001_group3.dorm_repair.dto;

import java.time.LocalDate;

/**
 * U6 (Task46): Request body ของ PUT /api/staff/repair-requests/{id}/assign ตาม API spec Sprint 2 ข้อ 2.4
 * urgency และ appointmentSlot รับเป็นข้อความ เพื่อให้ค่าผิดตอบ 400 พร้อมข้อความภาษาไทยได้
 * appointmentNote บังคับเฉพาะตอนกำหนดวันนัดใหม่ (ไม่ตรงกับช่วงที่ 1 หรือ 2 ที่ผู้พักอาศัยเสนอ)
 */
public record AssignTechnicianRequestDTO(
        Long technicianId,
        String urgency,
        LocalDate appointmentDate,
        String appointmentSlot,
        String appointmentNote
) {}
