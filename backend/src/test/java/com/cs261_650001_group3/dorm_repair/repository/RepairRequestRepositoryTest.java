package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.LocationType;
import com.cs261_650001_group3.dorm_repair.entity.RepairCategory;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.TimeSlot;
import com.cs261_650001_group3.dorm_repair.entity.Urgency;
import jakarta.persistence.PersistenceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit test ของ RepairRequestRepository:
 * Sprint 1: UT-DAO-05 ถึง 13 และ 19 ถึง 21
 * Sprint 2: UT-DAO-24 ถึง 34
 * ใช้ H2 ในหน่วยความจำ ไม่ต้องเปิด Docker ทุก test rollback เองเมื่อจบ
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class RepairRequestRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired RepairRequestRepository repo;

    TestData d;

    @BeforeEach
    void setUp() {
        d = TestData.seed(em);
    }

    /** คำร้องใหม่ที่มีช่องบังคับครบ แบบที่หน้าฟอร์มส่งมา */
    private RepairRequest newRequest(String contactPhone) {
        return new RepairRequest(d.u1, LocationType.ROOM, "อาคาร A", "ชั้น 3 · ห้อง 305",
                RepairCategory.ELECTRICAL, "หลอดไฟระเบียง", "หลอดไฟระเบียงกะพริบตลอด",
                LocalDate.of(2026, 10, 20), TimeSlot.MORNING, contactPhone);
    }

    @Test
    void UT_DAO_05_save_newRequest_defaults() {
        RepairRequest saved = repo.saveAndFlush(newRequest("081-234-5678"));

        assertThat(saved.getRequestId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(RequestStatus.PENDING);
        assertThat(saved.getUrgency()).isEqualTo(Urgency.NORMAL);
        assertThat(saved.getAppointmentDateTime()).isNull();
        assertThat(saved.getAppointmentNote()).isNull();
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void UT_DAO_06_save_requiredFieldNull_fails() {
        assertThatThrownBy(() -> repo.saveAndFlush(newRequest(null)))
                .isInstanceOfAny(DataIntegrityViolationException.class, PersistenceException.class);
    }

    @Test
    void UT_DAO_07_findMyRequests_newestFirst() {
        List<RepairRequest> result = repo.findByResidentUserIdOrderByCreatedAtDesc(d.u1.getUserId());

        assertThat(result)
                .extracting(RepairRequest::getTitle)
                .containsExactly("ไฟห้องน้ำดับ", "ก๊อกน้ำอ่างล้างหน้ารั่ว", "แอร์ไม่เย็น");
    }

    @Test
    void UT_DAO_08_findMyRequests_notOthers() {
        List<RepairRequest> result = repo.findByResidentUserIdOrderByCreatedAtDesc(d.u2.getUserId());

        assertThat(result)
                .extracting(RepairRequest::getRequestId)
                .containsExactly(d.r1021.getRequestId(), d.r1020.getRequestId(), d.r4.getRequestId());
    }

    @Test
    void UT_DAO_09_findMyRequests_none_returnsEmptyList() {
        List<RepairRequest> result = repo.findByResidentUserIdOrderByCreatedAtDesc(d.u3.getUserId());

        assertThat(result).isNotNull().isEmpty();
    }

    @Test
    void UT_DAO_10_findById_found() {
        em.clear();

        Optional<RepairRequest> result = repo.findById(d.r1.getRequestId());

        assertThat(result).isPresent();
        assertThat(result.get().getTitle()).isEqualTo("ไฟห้องน้ำดับ");
        assertThat(result.get().getCategory()).isEqualTo(RepairCategory.ELECTRICAL);
        assertThat(result.get().getBuilding()).isEqualTo("อาคาร A");
    }

    @Test
    void UT_DAO_11_findById_notFound() {
        assertThat(repo.findById(9999L)).isEmpty();
    }

    @Test
    void UT_DAO_12_save_changeStatus() {
        LocalDateTime before = d.r1.getUpdatedAt();

        d.r1.setStatus(RequestStatus.IN_PROGRESS);
        repo.saveAndFlush(d.r1);
        em.clear();

        RepairRequest reloaded = repo.findById(d.r1.getRequestId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(RequestStatus.IN_PROGRESS);
        assertThat(reloaded.getUpdatedAt()).isAfter(before);
    }

    @Test
    void UT_DAO_13_enumsStoredAsText() {
        Object[] row = (Object[]) em.getEntityManager()
                .createNativeQuery("SELECT status, urgency, location_type, preferred_slot_1 "
                        + "FROM repair_requests WHERE request_id = ?1")
                .setParameter(1, d.r1.getRequestId())
                .getSingleResult();

        assertThat(row).containsExactly("PENDING", "NORMAL", "ROOM", "MORNING");
    }

    @Test
    void UT_DAO_19_save_optionalFieldsNull() {
        RepairRequest saved = repo.saveAndFlush(newRequest("081-234-5678"));
        em.clear();

        RepairRequest reloaded = repo.findById(saved.getRequestId()).orElseThrow();
        assertThat(reloaded.getPreferredDate2()).isNull();
        assertThat(reloaded.getPreferredSlot2()).isNull();
        assertThat(reloaded.getLineId()).isNull();
    }

    @Test
    void UT_DAO_20_findOwnDetail_withImages() {
        d.r2.addImage("/uploads/1019-1.jpg", 612_352);
        d.r2.addImage("/uploads/1019-2.jpg", 487_424);
        em.flush();
        em.clear();

        Optional<RepairRequest> result =
                repo.findByRequestIdAndResidentUserId(d.r2.getRequestId(), d.u1.getUserId());

        assertThat(result).isPresent();
        RepairRequest r = result.get();
        assertThat(r.getImages()).hasSize(2);
        assertThat(r.getUrgency()).isEqualTo(Urgency.URGENT);
        assertThat(r.getTechnician().getUsername()).isEqualTo("tech03");
    }

    @Test
    void UT_DAO_21_findOthersDetail_returnsEmpty() {
        Optional<RepairRequest> result =
                repo.findByRequestIdAndResidentUserId(d.r4.getRequestId(), d.u1.getUserId());

        assertThat(result).isEmpty();
    }

    // =========================================================================
    // Sprint 2: UT-DAO-24 ถึง UT-DAO-34
    // =========================================================================

    @Test
    void UT_DAO_24_findByStatus_urgentFirstThenNewestFirst() {
        // สร้างคำร้อง PENDING ใหม่ 1 ใบในเทส: urgency = URGENT, createdAt เก่ากว่าทั้งสองใบ
        RepairRequest rUrgent = new RepairRequest(d.u1, LocationType.ROOM, "อาคาร A", "ชั้น 1",
                RepairCategory.ELECTRICAL, "ปลั๊กไฟไหม้", "มีกลิ่นไหม้",
                LocalDate.of(2026, 11, 30), TimeSlot.MORNING, "081-111-2222");
        rUrgent.setUrgency(Urgency.URGENT);
        rUrgent.setCreatedAt(LocalDateTime.of(2026, 10, 5, 9, 0));
        em.persist(rUrgent);
        em.flush();
        em.clear();

        Sort sort = Sort.by(Sort.Direction.DESC, "urgency").and(Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<RepairRequest> page = repo.findByStatus(RequestStatus.PENDING, PageRequest.of(0, 10, sort));

        assertThat(page.getContent())
                .extracting(RepairRequest::getRequestId)
                .containsExactly(rUrgent.getRequestId(), d.r1021.getRequestId(), d.r1.getRequestId());
    }

    @Test
    void UT_DAO_25_findByStatus_pagination() {
        // สร้างคำร้อง PENDING เพิ่มอีก 1 ใบ รวมกับใน TestData 2 ใบ (#1024, #1021) เป็น 3 ใบ
        RepairRequest rExtra = new RepairRequest(d.u1, LocationType.ROOM, "อาคาร A", "ชั้น 2",
                RepairCategory.PLUMBING, "ท่อน้ำหยด", "หยดเล็กน้อย",
                LocalDate.of(2026, 11, 30), TimeSlot.MORNING, "081-333-4444");
        em.persist(rExtra);
        em.flush();
        em.clear();

        Sort sort = Sort.by(Sort.Direction.DESC, "urgency").and(Sort.by(Sort.Direction.DESC, "createdAt"));

        // หน้าแรก: 2 รายการ
        Page<RepairRequest> p0 = repo.findByStatus(RequestStatus.PENDING, PageRequest.of(0, 2, sort));
        assertThat(p0.getContent()).hasSize(2);
        assertThat(p0.getTotalElements()).isEqualTo(3);
        assertThat(p0.getTotalPages()).isEqualTo(2);
        assertThat(p0.hasNext()).isTrue();

        // หน้าสอง: 1 รายการ
        Page<RepairRequest> p1 = repo.findByStatus(RequestStatus.PENDING, PageRequest.of(1, 2, sort));
        assertThat(p1.getContent()).hasSize(1);
        assertThat(p1.hasNext()).isFalse();
    }

    @Test
    void UT_DAO_26_setUrgency_updatesFieldAndUpdatedAt() {
        LocalDateTime before = d.r1.getUpdatedAt();

        d.r1.setUrgency(Urgency.URGENT);
        repo.saveAndFlush(d.r1);
        em.clear();

        RepairRequest reloaded = repo.findById(d.r1.getRequestId()).orElseThrow();
        assertThat(reloaded.getUrgency()).isEqualTo(Urgency.URGENT);
        assertThat(reloaded.getUpdatedAt()).isAfter(before);
    }

    @Test
    void UT_DAO_27_assignTechnician_andAppointmentNote_andHistory() {
        d.r1.assignTechnician(d.tech01);
        d.r1.setAppointmentDateTime(LocalDateTime.of(2026, 11, 30, 9, 0));
        d.r1.setAppointmentNote("เตรียมอะไหล่มาด้วย");
        d.r1.setUrgency(Urgency.URGENT);
        d.r1.changeStatus(RequestStatus.IN_PROGRESS, d.u4, "รับเรื่องและมอบหมายช่าง วิชัย สายลม");

        repo.saveAndFlush(d.r1);
        em.clear();

        RepairRequest reloaded = repo.findById(d.r1.getRequestId()).orElseThrow();
        assertThat(reloaded.getTechnician().getUserId()).isEqualTo(d.tech01.getUserId());
        assertThat(reloaded.getAppointmentDateTime()).isEqualTo(LocalDateTime.of(2026, 11, 30, 9, 0));
        assertThat(reloaded.getAppointmentNote()).isEqualTo("เตรียมอะไหล่มาด้วย");
        assertThat(reloaded.getUrgency()).isEqualTo(Urgency.URGENT);
        assertThat(reloaded.getStatus()).isEqualTo(RequestStatus.IN_PROGRESS);

        assertThat(reloaded.getStatusHistory()).filteredOn(h -> h.getStatus() == RequestStatus.IN_PROGRESS)
                .hasSize(1)
                .first()
                .satisfies(h -> {
                    assertThat(h.getChangedBy().getUserId()).isEqualTo(d.u4.getUserId());
                    assertThat(h.getNote()).isEqualTo("รับเรื่องและมอบหมายช่าง วิชัย สายลม");
                });
    }

    @Test
    void UT_DAO_28_countAppointmentsInSlot_overlapping() {
        // tech03 มีงาน IN_PROGRESS 2 งานวันที่ 30/11/2569: #1019 (13:00) และ #1020 (14:30) ทั้งคู่ >= 12:00
        long count = repo.countByTechnicianUserIdAndStatusAndAppointmentDateTimeBetween(
                d.tech03.getUserId(),
                RequestStatus.IN_PROGRESS,
                LocalDateTime.of(2026, 11, 30, 12, 0, 0),
                LocalDateTime.of(2026, 11, 30, 23, 59, 59));

        assertThat(count).isEqualTo(2);
    }

    @Test
    void UT_DAO_29_countAppointmentsInSlot_morningEmpty() {
        // tech03 มีนัดวันที่ 30/11/2569 เฉพาะช่วงบ่าย ไม่มีนัดก่อน 12:00
        long count = repo.countByTechnicianUserIdAndStatusAndAppointmentDateTimeBetween(
                d.tech03.getUserId(),
                RequestStatus.IN_PROGRESS,
                LocalDateTime.of(2026, 11, 30, 0, 0, 0),
                LocalDateTime.of(2026, 11, 30, 11, 59, 59));

        assertThat(count).isEqualTo(0);
    }

    @Test
    void UT_DAO_30_countAppointmentsInSlot_completedNotCounted() {
        // tech05 มีงาน #1003 นัด 22/09/2569 10:00 (ช่วงเช้า) สถานะ COMPLETED
        long inProgressCount = repo.countByTechnicianUserIdAndStatusAndAppointmentDateTimeBetween(
                d.tech05.getUserId(),
                RequestStatus.IN_PROGRESS,
                LocalDateTime.of(2026, 9, 22, 0, 0, 0),
                LocalDateTime.of(2026, 9, 22, 11, 59, 59));
        assertThat(inProgressCount).isEqualTo(0);

        long completedCount = repo.countByTechnicianUserIdAndStatusAndAppointmentDateTimeBetween(
                d.tech05.getUserId(),
                RequestStatus.COMPLETED,
                LocalDateTime.of(2026, 9, 22, 0, 0, 0),
                LocalDateTime.of(2026, 9, 22, 11, 59, 59));
        assertThat(completedCount).isEqualTo(1);
    }

    @Test
    void UT_DAO_31_findAssignedJobs_orderedByDateThenUrgency() {
        // ปรับนัด #1019 (URGENT) เป็น 16:00 ให้ช้ากว่า #1020 (NORMAL, 14:30)
        d.r2.setAppointmentDateTime(LocalDateTime.of(2026, 11, 30, 16, 0));
        repo.saveAndFlush(d.r2);

        // สร้างงาน rEarly ของ tech03: IN_PROGRESS, NORMAL, นัด 2026-11-29T10:00
        RepairRequest rEarly = new RepairRequest(d.u1, LocationType.ROOM, "อาคาร A", "ชั้น 1",
                RepairCategory.PLUMBING, "ท่อตัน", "น้ำไม่ไหล",
                LocalDate.of(2026, 11, 29), TimeSlot.MORNING, "081-123-4567");
        rEarly.setStatus(RequestStatus.IN_PROGRESS);
        rEarly.assignTechnician(d.tech03);
        rEarly.setAppointmentDateTime(LocalDateTime.of(2026, 11, 29, 10, 0));
        em.persist(rEarly);

        // สร้างงาน rDone ของ tech03: COMPLETED (ต้องไม่ติดมาใน assigned jobs)
        RepairRequest rDone = new RepairRequest(d.u1, LocationType.ROOM, "อาคาร A", "ชั้น 1",
                RepairCategory.PLUMBING, "ก็อกซ่อมแล้ว", "เรียบร้อย",
                LocalDate.of(2026, 11, 28), TimeSlot.MORNING, "081-123-4567");
        rDone.setStatus(RequestStatus.COMPLETED);
        rDone.assignTechnician(d.tech03);
        rDone.setAppointmentDateTime(LocalDateTime.of(2026, 11, 29, 14, 0));
        em.persist(rDone);

        // สร้างงาน rOther ของช่างคนอื่น (tech01): IN_PROGRESS ต้องไม่ติดมาใน assigned jobs ของ tech03
        RepairRequest rOther = new RepairRequest(d.u1, LocationType.ROOM, "อาคาร A", "ชั้น 1",
                RepairCategory.ELECTRICAL, "ไฟกะพริบ", "ไฟกะพริบตลอด",
                LocalDate.of(2026, 11, 29), TimeSlot.MORNING, "081-123-4567");
        rOther.setStatus(RequestStatus.IN_PROGRESS);
        rOther.assignTechnician(d.tech01);
        rOther.setAppointmentDateTime(LocalDateTime.of(2026, 11, 29, 9, 0));
        em.persist(rOther);

        em.flush();
        em.clear();

        List<RepairRequest> jobs = repo.findAssignedJobs(d.tech03.getUserId());

        // ต้องเรียงเป็น rEarly (29/11) -> #1019 (30/11 URGENT 16:00) -> #1020 (30/11 NORMAL 14:30)
        assertThat(jobs)
                .extracting(RepairRequest::getRequestId)
                .containsExactly(rEarly.getRequestId(), d.r2.getRequestId(), d.r1020.getRequestId());
    }

    @Test
    void UT_DAO_32_findAssignedJobs_none_returnsEmptyList() {
        List<RepairRequest> jobs = repo.findAssignedJobs(d.tech02.getUserId());
        assertThat(jobs).isNotNull().isEmpty();
    }

    @Test
    void UT_DAO_33_findByTechnicianUserIdAndStatus_completed_pageable() {
        Page<RepairRequest> page = repo.findByTechnicianUserIdAndStatus(
                d.tech05.getUserId(),
                RequestStatus.COMPLETED,
                PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "updatedAt")));

        assertThat(page.getContent())
                .extracting(RepairRequest::getRequestId)
                .containsExactly(d.r3.getRequestId());
        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getTotalPages()).isEqualTo(1);
    }

    @Test
    void UT_DAO_34_technicianDeliversJob_changesStatusToCompleted() {
        LocalDateTime before = d.r1020.getUpdatedAt();

        d.r1020.changeStatus(RequestStatus.COMPLETED, d.tech03, "เปลี่ยนท่อน้ำทิ้งใหม่ ใช้งานได้ปกติ");
        repo.saveAndFlush(d.r1020);
        em.clear();

        RepairRequest reloaded = repo.findById(d.r1020.getRequestId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(RequestStatus.COMPLETED);
        assertThat(reloaded.getUpdatedAt()).isAfter(before);

        assertThat(reloaded.getStatusHistory()).filteredOn(h -> h.getStatus() == RequestStatus.COMPLETED)
                .hasSize(1)
                .first()
                .satisfies(h -> {
                    assertThat(h.getChangedBy().getUserId()).isEqualTo(d.tech03.getUserId());
                    assertThat(h.getNote()).isEqualTo("เปลี่ยนท่อน้ำทิ้งใหม่ ใช้งานได้ปกติ");
                });
    }
}
