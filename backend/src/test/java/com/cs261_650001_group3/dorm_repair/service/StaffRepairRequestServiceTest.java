package com.cs261_650001_group3.dorm_repair.service;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.cs261_650001_group3.dorm_repair.dto.PageResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.StaffRequestDetailDTO;
import com.cs261_650001_group3.dorm_repair.dto.StaffRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.entity.ImageType;
import com.cs261_650001_group3.dorm_repair.entity.LocationType;
import com.cs261_650001_group3.dorm_repair.entity.RepairCategory;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.entity.TimeSlot;
import com.cs261_650001_group3.dorm_repair.entity.Urgency;
import com.cs261_650001_group3.dorm_repair.entity.User;

/**
 * Unit test ของ Task42 U4: API รายการและรายละเอียดคำร้อง (เจ้าหน้าที่)
 * ทดสอบ RepairRequestService.getStaffRequests / getStaffRequestDetail และ AuthService.requireRole
 * ใช้ H2 ในหน่วยความจำ ไม่ต้องเปิด Docker
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import({RepairRequestService.class, ImageStorageService.class, AuthService.class})
class StaffRepairRequestServiceTest {

    @Autowired TestEntityManager em;
    @Autowired RepairRequestService service;
    @Autowired AuthService authService;

    User somchai;  // resident01
    User manee;    // resident02
    User staff;    // staff01
    User tech03;   // ช่างประปาที่ได้รับงาน
    User tech04;   // ช่างประปาอีกคน ไม่ได้รับงาน

    RepairRequest pendingOld;     // PENDING NORMAL แจ้ง 10/10
    RepairRequest pendingNew;     // PENDING NORMAL แจ้ง 12/10
    RepairRequest pendingUrgent;  // PENDING URGENT แจ้ง 09/10 (เก่าสุดแต่ต้องขึ้นก่อน)
    RepairRequest inProgress;     // IN_PROGRESS ของ tech03 นัดบ่าย
    RepairRequest completed;      // COMPLETED ของ tech03 มีรูป AFTER และผลการซ่อม

    @BeforeEach
    void setUp() {
        somchai = em.persist(user("resident01", "สมชาย ใจดี", Role.RESIDENT, "081-234-5678"));
        manee = em.persist(user("resident02", "มานี มีสุข", Role.RESIDENT, "082-345-6789"));
        staff = em.persist(user("staff01", "สุดา พรศรี", Role.STAFF, "02-555-0180"));
        tech03 = em.persist(user("tech03", "ชาญชัย ท่อน้ำดี", Role.TECHNICIAN, "089-555-0103"));
        tech04 = em.persist(user("tech04", "ประเสริฐ ประปาไทย", Role.TECHNICIAN, "089-555-0104"));

        pendingOld = request(somchai, "ไฟห้องน้ำดับ", LocalDateTime.of(2026, 10, 10, 10, 0));
        pendingOld.addImage("/uploads/1024-1.jpg", 500_000);
        pendingOld.addHistory(RequestStatus.PENDING, somchai, "ส่งคำร้อง")
                .setChangedAt(LocalDateTime.of(2026, 10, 10, 10, 0));

        pendingNew = request(manee, "ชักโครกน้ำไหลไม่หยุด", LocalDateTime.of(2026, 10, 12, 9, 0));

        pendingUrgent = request(manee, "ท่อน้ำแตก", LocalDateTime.of(2026, 10, 9, 8, 0));
        pendingUrgent.setUrgency(Urgency.URGENT);

        inProgress = request(somchai, "ก๊อกน้ำรั่ว", LocalDateTime.of(2026, 10, 8, 8, 0));
        inProgress.setStatus(RequestStatus.IN_PROGRESS);
        inProgress.assignTechnician(tech03);
        inProgress.setAppointmentDateTime(LocalDateTime.of(2026, 10, 14, 13, 0));
        inProgress.setAppointmentNote("ช่างจะเข้ามาช่วง 13:30 น.");

        completed = request(somchai, "ท่อน้ำทิ้งอุดตัน", LocalDateTime.of(2026, 10, 1, 8, 0));
        completed.setPreferredSlot2(LocalDate.of(2026, 10, 4), TimeSlot.AFTERNOON);
        completed.setLineId("somchai305");
        completed.setStatus(RequestStatus.COMPLETED);
        completed.assignTechnician(tech03);
        completed.setAppointmentDateTime(LocalDateTime.of(2026, 10, 3, 9, 0));
        completed.addImage("/uploads/1003-1.jpg", 400_000);
        completed.addImage("/uploads/1003-after.jpg", 400_000, ImageType.AFTER);
        completed.addHistory(RequestStatus.PENDING, somchai, "ส่งคำร้อง")
                .setChangedAt(LocalDateTime.of(2026, 10, 1, 8, 0));
        completed.addHistory(RequestStatus.IN_PROGRESS, staff, "มอบหมายช่างชาญชัย")
                .setChangedAt(LocalDateTime.of(2026, 10, 1, 12, 0));
        completed.addHistory(RequestStatus.COMPLETED, tech03, "เปลี่ยนท่อน้ำทิ้งเรียบร้อย")
                .setChangedAt(LocalDateTime.of(2026, 10, 3, 10, 30));

        for (RepairRequest r : new RepairRequest[]{pendingOld, pendingNew, pendingUrgent, inProgress, completed}) {
            em.persist(r);
        }
        em.flush();
        em.clear();
    }

    // ---------- GET /api/staff/repair-requests ----------

    @Test
    void list_noStatus_returnsAllRequests_urgentFirstThenNewest() {
        PageResponseDTO<StaffRequestSummaryDTO> res = service.getStaffRequests(null, 0, 10);

        assertThat(res.totalCount()).isEqualTo(5);
        assertThat(res.totalPages()).isEqualTo(1);
        assertThat(res.content()).extracting(StaffRequestSummaryDTO::title).containsExactly(
                "ท่อน้ำแตก", "ชักโครกน้ำไหลไม่หยุด", "ไฟห้องน้ำดับ", "ก๊อกน้ำรั่ว", "ท่อน้ำทิ้งอุดตัน");
    }

    @Test
    void list_filterPending_returnsOnlyPending() {
        PageResponseDTO<StaffRequestSummaryDTO> res = service.getStaffRequests(RequestStatus.PENDING, 0, 10);

        assertThat(res.totalCount()).isEqualTo(3);
        assertThat(res.content()).allMatch(r -> r.status().equals("PENDING"));
        assertThat(res.content().get(0).urgency()).isEqualTo("URGENT");
    }

    @Test
    void list_summaryHasReporterAndLocation() {
        StaffRequestSummaryDTO row = service.getStaffRequests(RequestStatus.PENDING, 0, 10).content().stream()
                .filter(r -> r.title().equals("ไฟห้องน้ำดับ")).findFirst().orElseThrow();

        assertThat(row.reporterName()).isEqualTo("สมชาย ใจดี");
        assertThat(row.reporterPhone()).isEqualTo("081-234-5678");
        assertThat(row.building()).isEqualTo("อาคาร A");
        assertThat(row.locationDetail()).isEqualTo("ชั้น 3 · ห้อง 305");
        assertThat(row.locationType()).isEqualTo("ROOM");
        assertThat(row.category()).isEqualTo("PLUMBING");
        assertThat(row.createdAt()).isEqualTo(LocalDateTime.of(2026, 10, 10, 10, 0));
    }

    @Test
    void list_pagination_secondPage() {
        PageResponseDTO<StaffRequestSummaryDTO> res = service.getStaffRequests(null, 1, 2);

        assertThat(res.page()).isEqualTo(1);
        assertThat(res.size()).isEqualTo(2);
        assertThat(res.totalCount()).isEqualTo(5);
        assertThat(res.totalPages()).isEqualTo(3);
        assertThat(res.content()).extracting(StaffRequestSummaryDTO::title)
                .containsExactly("ไฟห้องน้ำดับ", "ก๊อกน้ำรั่ว");
    }

    @Test
    void list_pageBeyondEnd_returnsEmptyContent() {
        PageResponseDTO<StaffRequestSummaryDTO> res = service.getStaffRequests(null, 5, 10);
        assertThat(res.content()).isEmpty();
        assertThat(res.totalCount()).isEqualTo(5);
    }

    @Test
    void list_invalidPageOrSize_400() {
        assertStatus(() -> service.getStaffRequests(null, -1, 10), HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.getStaffRequests(null, 0, 0), HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.getStaffRequests(null, 0, 51), HttpStatus.BAD_REQUEST);
    }

    // ---------- GET /api/staff/repair-requests/{id} ----------

    @Test
    void detail_pending_hasFormDataAndNoTechnician() {
        StaffRequestDetailDTO d = service.getStaffRequestDetail(pendingOld.getRequestId(), staff);

        assertThat(d.status()).isEqualTo("PENDING");
        assertThat(d.reporterName()).isEqualTo("สมชาย ใจดี");
        assertThat(d.description()).isEqualTo("รายละเอียดของ ไฟห้องน้ำดับ");
        assertThat(d.preferredDate1()).isEqualTo(LocalDate.of(2026, 10, 14));
        assertThat(d.preferredSlot1()).isEqualTo("MORNING");
        assertThat(d.imageUrls()).containsExactly("/uploads/1024-1.jpg");
        assertThat(d.technician()).isNull();
        assertThat(d.appointmentDate()).isNull();
        assertThat(d.appointmentSlot()).isNull();
        assertThat(d.repairResult()).isNull();
        assertThat(d.completedAt()).isNull();
        assertThat(d.statusHistory()).hasSize(1);
    }

    @Test
    void detail_inProgress_splitsAppointmentIntoDateAndSlot() {
        StaffRequestDetailDTO d = service.getStaffRequestDetail(inProgress.getRequestId(), staff);

        assertThat(d.technician().name()).isEqualTo("ชาญชัย ท่อน้ำดี");
        assertThat(d.technician().phone()).isEqualTo("089-555-0103");
        assertThat(d.appointmentDate()).isEqualTo(LocalDate.of(2026, 10, 14));
        assertThat(d.appointmentSlot()).isEqualTo("AFTERNOON");
        assertThat(d.appointmentNote()).isEqualTo("ช่างจะเข้ามาช่วง 13:30 น.");
    }

    @Test
    void detail_completed_hasRepairResultAndSeparatesAfterImages() {
        StaffRequestDetailDTO d = service.getStaffRequestDetail(completed.getRequestId(), staff);

        assertThat(d.status()).isEqualTo("COMPLETED");
        assertThat(d.appointmentSlot()).isEqualTo("MORNING");
        assertThat(d.preferredSlot2()).isEqualTo("AFTERNOON");
        assertThat(d.lineId()).isEqualTo("somchai305");
        assertThat(d.imageUrls()).containsExactly("/uploads/1003-1.jpg");
        assertThat(d.afterImageUrls()).containsExactly("/uploads/1003-after.jpg");
        assertThat(d.repairResult()).isEqualTo("เปลี่ยนท่อน้ำทิ้งเรียบร้อย");
        assertThat(d.completedAt()).isEqualTo(LocalDateTime.of(2026, 10, 3, 10, 30));
        assertThat(d.statusHistory()).extracting(h -> h.status())
                .containsExactly("PENDING", "IN_PROGRESS", "COMPLETED");
    }

    @Test
    void detail_notFound_404() {
        assertStatus(() -> service.getStaffRequestDetail(999_999L, staff), HttpStatus.NOT_FOUND);
    }

    @Test
    void detail_assignedTechnician_canView() {
        StaffRequestDetailDTO d = service.getStaffRequestDetail(inProgress.getRequestId(), tech03);
        assertThat(d.requestId()).isEqualTo(inProgress.getRequestId());
    }

    @Test
    void detail_otherTechnician_403() {
        assertStatus(() -> service.getStaffRequestDetail(inProgress.getRequestId(), tech04), HttpStatus.FORBIDDEN);
        assertStatus(() -> service.getStaffRequestDetail(pendingOld.getRequestId(), tech03), HttpStatus.FORBIDDEN);
    }

    // ---------- AuthService.requireRole ----------

    @Test
    void requireRole_staffToken_returnsStaff() {
        String token = authService.login("staff01", "password123").token();
        User u = authService.requireRole("Bearer " + token, Role.STAFF);
        assertThat(u.getUserId()).isEqualTo(staff.getUserId());
    }

    @Test
    void requireRole_residentToken_403() {
        String token = authService.login("resident01", "password123").token();
        assertStatus(() -> authService.requireRole("Bearer " + token, Role.STAFF), HttpStatus.FORBIDDEN);
    }

    @Test
    void requireRole_noToken_401() {
        assertStatus(() -> authService.requireRole(null, Role.STAFF), HttpStatus.UNAUTHORIZED);
        assertStatus(() -> authService.requireRole("Bearer wrong-token", Role.STAFF), HttpStatus.UNAUTHORIZED);
    }

    // ---------- helpers ----------

    private static void assertStatus(Runnable call, HttpStatus expected) {
        assertThatThrownBy(call::run)
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(expected);
    }

    private static User user(String username, String fullName, Role role, String phone) {
        User u = new User(username, "$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy", fullName, role);
        u.setPhone(phone);
        return u;
    }

    private static RepairRequest request(User resident, String title, LocalDateTime createdAt) {
        RepairRequest r = new RepairRequest(resident, LocationType.ROOM, "อาคาร A", "ชั้น 3 · ห้อง 305",
                RepairCategory.PLUMBING, title, "รายละเอียดของ " + title,
                LocalDate.of(2026, 10, 14), TimeSlot.MORNING, resident.getPhone());
        r.setCreatedAt(createdAt);
        return r;
    }
}
