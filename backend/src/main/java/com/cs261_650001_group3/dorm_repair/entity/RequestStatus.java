package com.cs261_650001_group3.dorm_repair.entity;

/** สถานะคำร้องแจ้งซ่อม (ทีมยืนยันแล้ว 12 ต.ค. 2569) */
public enum RequestStatus {
    PENDING("รอรับเรื่อง"),
    IN_PROGRESS("กำลังดำเนินการ"),
    COMPLETED("เสร็จสิ้น");

    private final String label;

    RequestStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
