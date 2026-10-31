package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
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

    /** U4: เจ้าหน้าที่ดูคำร้องตามสถานะ พร้อมแบ่งหน้าและจัดเรียง */
    Page<RepairRequest> findByStatus(RequestStatus status, Pageable pageable);

    /** Sprint 2: ช่างดูงานที่ได้รับมอบหมาย เรียงตามเวลานัด */
    List<RepairRequest> findByTechnicianUserIdOrderByAppointmentDateTimeAsc(Long technicianId);

    /** U6: นับจำนวนนัดของช่างในช่วงเวลาที่กำหนด เพื่อตรวจเช็กนัดซ้อน */
    long countByTechnicianUserIdAndStatusAndAppointmentDateTimeBetween(
            Long technicianId, RequestStatus status, LocalDateTime start, LocalDateTime end);

    /**
     * U7: ช่างดูงาน IN_PROGRESS ของตนเอง เรียงตามวันนัด และวันเดียวกันให้งานเร่งด่วนขึ้นก่อน
     */
    @Query("SELECT r FROM RepairRequest r WHERE r.technician.userId = :technicianId "
            + "AND r.status = com.cs261_650001_group3.dorm_repair.entity.RequestStatus.IN_PROGRESS "
            + "ORDER BY CAST(r.appointmentDateTime AS LocalDate) ASC, r.urgency DESC, r.appointmentDateTime ASC")
    List<RepairRequest> findAssignedJobs(@Param("technicianId") Long technicianId);

    /** U7 / Task48: ดึงงานตามสถานะของช่าง พร้อมแบ่งหน้า (เช่น งาน COMPLETED) */
    Page<RepairRequest> findByTechnicianUserIdAndStatus(Long technicianId, RequestStatus status, Pageable pageable);

    /** U7 / Task48: ค้นหางานที่เสร็จแล้วของช่างด้วย keyword (ชื่อคำร้อง, สถานที่ หรือชื่อผู้แจ้ง) */
    @Query("SELECT r FROM RepairRequest r WHERE r.technician.userId = :technicianId "
            + "AND r.status = com.cs261_650001_group3.dorm_repair.entity.RequestStatus.COMPLETED "
            + "AND (LOWER(r.title) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + "OR LOWER(r.building) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + "OR LOWER(r.locationDetail) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + "OR LOWER(r.resident.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<RepairRequest> findCompletedJobsByKeyword(
            @Param("technicianId") Long technicianId,
            @Param("keyword") String keyword,
            Pageable pageable);
}
