package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * DAO ของคำร้องแจ้งซ่อม
 * save(), findById(), findAll(), deleteById() ได้มาจาก JpaRepository อยู่แล้ว
 * เมธอดข้างล่าง Spring สร้าง SQL ให้จากชื่อเมธอด ไม่ต้องเขียน query เอง
 */
@Repository
public interface RepairRequestRepository extends JpaRepository<RepairRequest, Long> {

    /** U3: รายการคำร้องของผู้พักอาศัยที่ล็อกอิน เรียงล่าสุดก่อน */
    List<RepairRequest> findByResidentUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * U3: รายละเอียดคำร้อง 1 ใบ เฉพาะของเจ้าของ
     * ถ้าเป็นของคนอื่นหรือไม่มีจะได้ Optional.empty() แล้ว Service แปลงเป็น 403/404
     * ดึงรูปมาพร้อมกัน ส่วนประวัติสถานะโหลดตอนเรียกใช้ (Service ต้องมี @Transactional)
     */
    @EntityGraph(attributePaths = {"images"})
    Optional<RepairRequest> findByRequestIdAndResidentUserId(Long requestId, Long userId);

    /** Sprint 2: เจ้าหน้าที่ดูคำร้องตามสถานะ เก่าสุดก่อน */
    List<RepairRequest> findByStatusOrderByCreatedAtAsc(RequestStatus status);

    /** Sprint 2: ช่างดูงานที่ได้รับมอบหมาย เรียงตามเวลานัด */
    List<RepairRequest> findByTechnicianUserIdOrderByAppointmentDateTimeAsc(Long technicianId);
}
