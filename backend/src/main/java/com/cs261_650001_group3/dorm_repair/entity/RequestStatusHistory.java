package com.cs261_650001_group3.dorm_repair.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.Nationalized;

import java.time.LocalDateTime;

/** ตาราง request_status_history ทุกครั้งที่สถานะเปลี่ยนจะมี 1 แถว ใช้ทำ timeline ใน U3 */
@Entity
@Table(name = "request_status_history")
public class RequestStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    private Long historyId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private RepairRequest repairRequest;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private RequestStatus status;

    /** ข้อความใต้แต่ละขั้นใน timeline เช่น "รับเรื่องและมอบหมายช่าง ..." */
    @Nationalized
    @Column(name = "note", length = 500)
    private String note;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "changed_by", nullable = false)
    private User changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private LocalDateTime changedAt;

    protected RequestStatusHistory() {
    }

    /** ปกติสร้างผ่าน RepairRequest.addHistory() หรือ changeStatus() */
    public RequestStatusHistory(RepairRequest repairRequest, RequestStatus status, User changedBy, String note) {
        this.repairRequest = repairRequest;
        this.status = status;
        this.changedBy = changedBy;
        this.note = note;
    }

    @PrePersist
    void onCreate() {
        if (changedAt == null) {
            changedAt = LocalDateTime.now();
        }
    }

    /** ใช้กับข้อมูลตั้งต้นและ test เท่านั้น ปกติระบบตั้งเวลาให้เอง */
    public void setChangedAt(LocalDateTime changedAt) { this.changedAt = changedAt; }

    public Long getHistoryId() { return historyId; }
    public RepairRequest getRepairRequest() { return repairRequest; }
    public RequestStatus getStatus() { return status; }
    public String getNote() { return note; }
    public User getChangedBy() { return changedBy; }
    public LocalDateTime getChangedAt() { return changedAt; }
}
