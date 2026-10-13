package com.cs261_650001_group3.dorm_repair.entity;

/** ช่วงเวลาที่สะดวกให้ช่างเข้า */
public enum TimeSlot {
    MORNING(9),     // 09:00–12:00 น.
    AFTERNOON(13);  // 13:00–16:00 น.

    private final int startHour;

    TimeSlot(int startHour) {
        this.startHour = startHour;
    }

    /** ชั่วโมงที่ช่วงเริ่ม ใช้เช็กว่าช่วงที่เลือกอยู่ในอนาคตหรือยัง */
    public int getStartHour() {
        return startHour;
    }
}
