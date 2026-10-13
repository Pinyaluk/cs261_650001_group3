package com.cs261_650001_group3.dorm_repair.entity;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.Nationalized;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * ตาราง repair_requests (คำร้องแจ้งซ่อม) ตรงกับ database/init.sql
 * รูปและประวัติสถานะเป็นส่วนประกอบ ลบคำร้องแล้วหายตามไปด้วย
 */
@Entity
@Table(name = "repair_requests")
public class RepairRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "request_id")
    private Long requestId;

    /** ผู้พักอาศัยที่แจ้ง */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "resident_id", nullable = false)
    private User resident;

    /** ช่างที่ได้รับมอบหมาย (Sprint 2) ยังว่างได้ */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "technician_id")
    private User technician;

    @Enumerated(EnumType.STRING)
    @Column(name = "location_type", nullable = false, length = 20)
    private LocationType locationType;

    @Nationalized
    @Column(name = "building", nullable = false, length = 50)
    private String building;

    /** เช่น "ชั้น 3 · ห้อง 305" */
    @Nationalized
    @Column(name = "location_detail", nullable = false, length = 100)
    private String locationDetail;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30)
    private RepairCategory category;

    /** มาจากช่อง "อุปกรณ์ที่ชำรุด" ในฟอร์ม */
    @Nationalized
    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Nationalized
    @Column(name = "description", nullable = false, length = 1000)
    private String description;

    @Column(name = "preferred_date_1", nullable = false)
    private LocalDate preferredDate1;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_slot_1", nullable = false, length = 20)
    private TimeSlot preferredSlot1;

    @Column(name = "preferred_date_2")
    private LocalDate preferredDate2;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_slot_2", length = 20)
    private TimeSlot preferredSlot2;

    /** เวลานัดที่เจ้าหน้าที่ยืนยัน (Sprint 2) ยังว่างได้ */
    @Column(name = "appointment_datetime")
    private LocalDateTime appointmentDateTime;

    @Column(name = "contact_phone", nullable = false, length = 20)
    private String contactPhone;

    @Column(name = "line_id", length = 50)
    private String lineId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private RequestStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "urgency", nullable = false, length = 20)
    private Urgency urgency;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "repairRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("imageId ASC")
    private List<RequestImage> images = new ArrayList<>();

    @OneToMany(mappedBy = "repairRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("changedAt ASC")
    private List<RequestStatusHistory> statusHistory = new ArrayList<>();

    protected RepairRequest() {
        // JPA ต้องมี constructor ว่าง
    }

    /**
     * สร้างคำร้องใหม่จากช่องบังคับในฟอร์ม
     * สถานะเริ่มเป็น PENDING และ urgency เป็น NORMAL
     * ช่องไม่บังคับ (ช่วงที่ 2, ไอดีไลน์) ใส่ทีหลังด้วย setter
     */
    public RepairRequest(User resident, LocationType locationType, String building, String locationDetail,
                         RepairCategory category, String title, String description,
                         LocalDate preferredDate1, TimeSlot preferredSlot1, String contactPhone) {
        this.resident = resident;
        this.locationType = locationType;
        this.building = building;
        this.locationDetail = locationDetail;
        this.category = category;
        this.title = title;
        this.description = description;
        this.preferredDate1 = preferredDate1;
        this.preferredSlot1 = preferredSlot1;
        this.contactPhone = contactPhone;
        this.status = RequestStatus.PENDING;
        this.urgency = Urgency.NORMAL;
    }

    /** ตั้งเวลาเองเฉพาะเมื่อยังว่าง ข้อมูลตั้งต้นและ test จึงกำหนดเวลาแจ้งเองได้ */
    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = createdAt;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /** แนบรูป (Service เป็นคนเช็กว่า 1–3 รูป รูปละไม่เกิน 5MB) */
    public RequestImage addImage(String filePath, long fileSize) {
        RequestImage image = new RequestImage(this, filePath, fileSize);
        images.add(image);
        return image;
    }

    /**
     * บันทึกประวัติสถานะ 1 แถว
     * ตอนส่งคำร้อง Service เรียก addHistory(PENDING, ผู้แจ้ง, "ส่งคำร้องพร้อมรูปภาพ 2 รูป") หลังแนบรูปแล้ว
     */
    public RequestStatusHistory addHistory(RequestStatus status, User changedBy, String note) {
        RequestStatusHistory history = new RequestStatusHistory(this, status, changedBy, note);
        statusHistory.add(history);
        return history;
    }

    /** เปลี่ยนสถานะพร้อมบันทึกประวัติ (Sprint 2: เจ้าหน้าที่และช่าง) */
    public void changeStatus(RequestStatus newStatus, User changedBy, String note) {
        this.status = newStatus;
        addHistory(newStatus, changedBy, note);
    }

    /** ช่วงเวลาที่สะดวกช่วงที่ 2 ต้องใส่ทั้งวันและช่วงเวลา หรือ null ทั้งคู่ */
    public void setPreferredSlot2(LocalDate date, TimeSlot slot) {
        this.preferredDate2 = date;
        this.preferredSlot2 = slot;
    }

    public void setLineId(String lineId) { this.lineId = lineId; }
    public void setStatus(RequestStatus status) { this.status = status; }
    public void assignTechnician(User technician) { this.technician = technician; }
    public void setAppointmentDateTime(LocalDateTime appointmentDateTime) { this.appointmentDateTime = appointmentDateTime; }
    public void setUrgency(Urgency urgency) { this.urgency = urgency; }

    /** ใช้กับข้อมูลตั้งต้นและ test เท่านั้น ปกติระบบตั้งเวลาให้เอง */
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Long getRequestId() { return requestId; }
    public User getResident() { return resident; }
    public User getTechnician() { return technician; }
    public LocationType getLocationType() { return locationType; }
    public String getBuilding() { return building; }
    public String getLocationDetail() { return locationDetail; }
    public RepairCategory getCategory() { return category; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public LocalDate getPreferredDate1() { return preferredDate1; }
    public TimeSlot getPreferredSlot1() { return preferredSlot1; }
    public LocalDate getPreferredDate2() { return preferredDate2; }
    public TimeSlot getPreferredSlot2() { return preferredSlot2; }
    public LocalDateTime getAppointmentDateTime() { return appointmentDateTime; }
    public String getContactPhone() { return contactPhone; }
    public String getLineId() { return lineId; }
    public RequestStatus getStatus() { return status; }
    public Urgency getUrgency() { return urgency; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public List<RequestImage> getImages() { return images; }
    public List<RequestStatusHistory> getStatusHistory() { return statusHistory; }
}
