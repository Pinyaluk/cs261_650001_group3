package com.cs261_650001_group3.dorm_repair.service;

import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;
import com.cs261_650001_group3.dorm_repair.entity.LocationType;
import com.cs261_650001_group3.dorm_repair.entity.RepairCategory;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.entity.TimeSlot;
import com.cs261_650001_group3.dorm_repair.entity.Urgency;
import com.cs261_650001_group3.dorm_repair.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit test ของ RepairRequestService (U3 ช่วง 2: ดึงข้อมูลจาก DB จริง)
 * ใช้ H2 ในหน่วยความจำ ไม่ต้องเปิด Docker
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import(RepairRequestService.class)
class RepairRequestServiceTest {

    @Autowired TestEntityManager em;
    @Autowired RepairRequestService service;

    User somchai;   // resident01 มี 2 คำร้อง
    User manee;     // resident02 มี 1 คำร้อง
    User piti;      // resident03 ไม่มีคำร้อง
    User tech;      // tech01
    RepairRequest pending;     // #ไฟห้องน้ำดับ ของสมชาย ยังไม่มีช่าง
    RepairRequest inProgress;  // #ก๊อกน้ำรั่ว ของสมชาย มีช่าง รูป 2 รูป ประวัติ 2 แถว
    RepairRequest ofManee;

    @BeforeEach
    void setUp() {
        somchai = em.persist(user("resident01", "สมชาย ใจดี", Role.RESIDENT, "081-234-5678"));
        manee = em.persist(user("resident02", "มานี มีสุข", Role.RESIDENT, "082-345-6789"));
        piti = em.persist(user("resident03", "ปิติ ชูใจ", Role.RESIDENT, "083-456-7890"));
        tech = em.persist(user("tech01", "วิชัย สายลม", Role.TECHNICIAN, "089-555-0148"));

        pending = request(somchai, RepairCategory.ELECTRICAL, "ไฟห้องน้ำดับ",
                LocalDateTime.of(2026, 10, 12, 10, 0));
        pending.addImage("/uploads/1024-1.jpg", 524288);
        pending.addHistory(RequestStatus.PENDING, somchai, "ส่งคำร้องพร้อมรูปภาพ 1 รูป")
                .setChangedAt(LocalDateTime.of(2026, 10, 12, 10, 0));

        inProgress = request(somchai, RepairCategory.PLUMBING, "ก๊อกน้ำอ่างล้างหน้ารั่ว",
                LocalDateTime.of(2026, 10, 10, 8, 40));
        inProgress.setPreferredSlot2(LocalDate.of(2026, 10, 14), TimeSlot.AFTERNOON);
        inProgress.setLineId("somchai305");
        inProgress.setUrgency(Urgency.URGENT);
        inProgress.setStatus(RequestStatus.IN_PROGRESS);
        inProgress.assignTechnician(tech);
        inProgress.setAppointmentDateTime(LocalDateTime.of(2026, 10, 14, 13, 0));
        inProgress.addImage("/uploads/1019-1.jpg", 612352);
        inProgress.addImage("/uploads/1019-2.jpg", 487424);
        inProgress.addHistory(RequestStatus.PENDING, somchai, "ส่งคำร้องพร้อมรูปภาพ 2 รูป")
                .setChangedAt(LocalDateTime.of(2026, 10, 10, 8, 40));
        inProgress.addHistory(RequestStatus.IN_PROGRESS, tech, "รับเรื่องและมอบหมายช่าง")
                .setChangedAt(LocalDateTime.of(2026, 10, 10, 9, 15));

        ofManee = request(manee, RepairCategory.FURNITURE, "บานพับตู้เสื้อผ้าหลุด",
                LocalDateTime.of(2026, 9, 14, 9, 0));

        em.persist(pending);
        em.persist(inProgress);
        em.persist(ofManee);
        em.flush();
        em.clear();   // ให้ Service อ่านจาก DB จริง ไม่ใช่จาก cache
    }

    @Test
    void UT_SVC_01_getMyRequests_onlyOwnRequests_newestFirst() {
        List<RepairRequestSummaryDTO> result = service.getMyRequests(somchai.getUserId());

        assertThat(result).extracting(RepairRequestSummaryDTO::title)
                .containsExactly("ไฟห้องน้ำดับ", "ก๊อกน้ำอ่างล้างหน้ารั่ว");
        assertThat(result.get(0).status()).isEqualTo("PENDING");
        assertThat(result.get(0).technicianName()).isNull();
        assertThat(result.get(1).status()).isEqualTo("IN_PROGRESS");
        assertThat(result.get(1).technicianName()).isEqualTo("วิชัย สายลม");
    }

    @Test
    void UT_SVC_02_getMyRequests_noRequests_returnsEmptyList() {
        assertThat(service.getMyRequests(piti.getUserId())).isEmpty();
    }

    @Test
    void UT_SVC_03_getRequestDetail_withTechnician_imagesAndHistory() {
        RepairRequestResponseDTO dto = service.getRequestDetail(inProgress.getRequestId(), somchai.getUserId());

        assertThat(dto.title()).isEqualTo("ก๊อกน้ำอ่างล้างหน้ารั่ว");
        assertThat(dto.status()).isEqualTo("IN_PROGRESS");
        assertThat(dto.urgency()).isEqualTo("URGENT");
        assertThat(dto.preferredSlot2()).isEqualTo("AFTERNOON");
        assertThat(dto.technician().name()).isEqualTo("วิชัย สายลม");
        assertThat(dto.technician().phone()).isEqualTo("089-555-0148");
        assertThat(dto.imageUrls()).containsExactly("/uploads/1019-1.jpg", "/uploads/1019-2.jpg");
        assertThat(dto.statusHistory()).extracting(StatusHistoryDTO::status).containsExactly("PENDING", "IN_PROGRESS");
        assertThat(dto.statusHistory().get(1).changedByName()).isEqualTo("วิชัย สายลม");
    }

    @Test
    void UT_SVC_04_getRequestDetail_pending_noTechnician() {
        RepairRequestResponseDTO dto = service.getRequestDetail(pending.getRequestId(), somchai.getUserId());

        assertThat(dto.status()).isEqualTo("PENDING");
        assertThat(dto.technician()).isNull();
        assertThat(dto.appointmentDateTime()).isNull();
        assertThat(dto.preferredSlot2()).isNull();
        assertThat(dto.statusHistory()).hasSize(1);
    }

    @Test
    void UT_SVC_05_getRequestDetail_otherUsersRequest_404() {
        assertThatThrownBy(() -> service.getRequestDetail(ofManee.getRequestId(), somchai.getUserId()))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void UT_SVC_06_getRequestDetail_notExist_404() {
        assertThatThrownBy(() -> service.getRequestDetail(99999L, somchai.getUserId()))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---------- helper ----------

    private static User user(String username, String fullName, Role role, String phone) {
        User u = new User(username, "$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy", fullName, role);
        u.setPhone(phone);
        return u;
    }

    private static RepairRequest request(User resident, RepairCategory category, String title,
                                         LocalDateTime createdAt) {
        RepairRequest r = new RepairRequest(resident, LocationType.ROOM, "อาคาร A", "ชั้น 3 · ห้อง 305",
                category, title, "รายละเอียดของ " + title,
                LocalDate.of(2026, 10, 14), TimeSlot.MORNING, "081-234-5678");
        r.setCreatedAt(createdAt);
        return r;
    }
}
