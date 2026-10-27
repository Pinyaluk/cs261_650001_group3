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

import java.time.LocalDateTime;

/** ตาราง request_images เก็บแค่ path ของรูป ตัวไฟล์อยู่ในโฟลเดอร์ uploads */
@Entity
@Table(name = "request_images")
public class RequestImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "image_id")
    private Long imageId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private RepairRequest repairRequest;

    /**
     * ประเภทรูปภาพ: BEFORE = ก่อนซ่อม (ผู้พักอาศัยแนบตอนแจ้ง),
     * AFTER = หลังซ่อม (ช่างแนบตอนส่งมอบงาน U8)
     * ต้องตั้ง default ใน entity เพราะ JPA ส่ง NULL ไปตรงๆ ทำให้ DEFAULT 'BEFORE' ใน DDL ไม่ทำงาน
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "image_type", nullable = false, length = 20)
    private ImageType imageType = ImageType.BEFORE;

    /** เช่น /uploads/1024-1.jpg */
    @Column(name = "file_path", nullable = false, length = 255)
    private String filePath;

    /** ขนาดไฟล์เป็นไบต์ */
    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private LocalDateTime uploadedAt;

    protected RequestImage() {
    }

    /**
     * สร้างรูปภาพก่อนซ่อม (BEFORE) — ปกติสร้างผ่าน RepairRequest.addImage()
     * imageType เป็น BEFORE อัตโนมัติจากค่าเริ่มต้นของฟิลด์
     */
    public RequestImage(RepairRequest repairRequest, String filePath, long fileSize) {
        this.repairRequest = repairRequest;
        this.filePath = filePath;
        this.fileSize = fileSize;
        // imageType ใช้ค่า default = BEFORE ที่ตั้งไว้บนฟิลด์
    }

    /**
     * สร้างรูปภาพพร้อมระบุประเภท — ใช้ตอน U8 ช่างแนบรูปหลังซ่อม (AFTER)
     */
    public RequestImage(RepairRequest repairRequest, String filePath, long fileSize, ImageType imageType) {
        this.repairRequest = repairRequest;
        this.filePath = filePath;
        this.fileSize = fileSize;
        this.imageType = imageType;
    }

    @PrePersist
    void onCreate() {
        if (uploadedAt == null) {
            uploadedAt = LocalDateTime.now();
        }
        // ป้องกัน null กรณีสร้างด้วย constructor ว่าง (เช่น JPA proxy)
        if (imageType == null) {
            imageType = ImageType.BEFORE;
        }
    }

    public Long getImageId() { return imageId; }
    public RepairRequest getRepairRequest() { return repairRequest; }
    public ImageType getImageType() { return imageType; }
    public String getFilePath() { return filePath; }
    public Long getFileSize() { return fileSize; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
}
