package com.cs261_650001_group3.dorm_repair.dto;

/**
 * U6 (Task46): ช่าง 1 คนใน GET /api/staff/technicians ตาม API spec Sprint 2 ข้อ 2.5
 * appointmentCount = จำนวนงาน IN_PROGRESS ที่ช่างมีนัดอยู่แล้วในวันและช่วงเวลาที่ส่งมา
 * (ไม่ได้ส่ง date/slot = 0) ใช้แสดง "ว่าง" หรือ "มีนัดแล้ว N งาน" ในหน้ามอบหมายงาน
 */
public record TechnicianAvailabilityDTO(
        Long id,
        String fullName,
        String specialty,
        String phone,
        long appointmentCount
) {}
