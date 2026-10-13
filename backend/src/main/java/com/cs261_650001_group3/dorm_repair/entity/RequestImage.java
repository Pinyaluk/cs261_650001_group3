package com.cs261_650001_group3.dorm_repair.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    /** ปกติสร้างผ่าน RepairRequest.addImage() */
    public RequestImage(RepairRequest repairRequest, String filePath, long fileSize) {
        this.repairRequest = repairRequest;
        this.filePath = filePath;
        this.fileSize = fileSize;
    }

    @PrePersist
    void onCreate() {
        if (uploadedAt == null) {
            uploadedAt = LocalDateTime.now();
        }
    }

    public Long getImageId() { return imageId; }
    public RepairRequest getRepairRequest() { return repairRequest; }
    public String getFilePath() { return filePath; }
    public Long getFileSize() { return fileSize; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
}
