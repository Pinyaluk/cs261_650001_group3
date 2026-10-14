package com.cs261_650001_group3.dorm_repair.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.Nationalized;

import java.time.LocalDateTime;

/**
 * ตาราง users (ตรงกับ database/init.sql)
 * ผู้ใช้ทุกบทบาทอยู่ตารางเดียว แยกด้วย role
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    /** รหัสผ่านที่ผ่าน BCrypt แล้ว ห้ามเก็บรหัสจริง */
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Nationalized
    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private Role role;

    /** ใช้กับผู้พักอาศัย เช่น A-305 */
    @Column(name = "room_number", length = 20)
    private String roomNumber;

    /** แสดงเบอร์ช่างและเจ้าหน้าที่ในหน้ารายละเอียดคำร้อง */
    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected User() {
        // JPA ต้องมี constructor ว่าง
    }

    public User(String username, String passwordHash, String fullName, Role role) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.role = role;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public Role getRole() { return role; }
    public String getRoomNumber() { return roomNumber; }
    public String getPhone() { return phone; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public void setRole(Role role) { this.role = role; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }
    public void setPhone(String phone) { this.phone = phone; }
}
