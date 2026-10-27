package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatusHistory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit test ของ RequestStatusHistoryRepository:
 * Sprint 1: UT-DAO-16 ถึง 18
 * Sprint 2: UT-DAO-35
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class RequestStatusHistoryRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired RequestStatusHistoryRepository repo;

    TestData d;

    @BeforeEach
    void setUp() {
        d = TestData.seed(em);
    }

    @Test
    void UT_DAO_16_save_firstStatus_withThaiNote() {
        RequestStatusHistory h = new RequestStatusHistory(
                d.r1, RequestStatus.PENDING, d.u1, "ส่งคำร้องพร้อมรูปภาพ 1 รูป");

        RequestStatusHistory saved = repo.saveAndFlush(h);
        em.clear();

        RequestStatusHistory reloaded = repo.findById(saved.getHistoryId()).orElseThrow();
        assertThat(reloaded.getHistoryId()).isNotNull();
        assertThat(reloaded.getChangedAt()).isNotNull();
        assertThat(reloaded.getNote()).isEqualTo("ส่งคำร้องพร้อมรูปภาพ 1 รูป");
    }

    @Test
    void UT_DAO_17_timeline_oldestFirst() {
        // ใส่แถวใหม่กว่าก่อน เพื่อพิสูจน์ว่าเรียงตามเวลา ไม่ใช่ตามลำดับที่บันทึก
        RequestStatusHistory inProgress = new RequestStatusHistory(d.r2, RequestStatus.IN_PROGRESS, d.u4,
                "รับเรื่องและมอบหมายช่าง วิชัย สายลม นัดเข้าซ่อม 14/10/2569 13:00");
        inProgress.setChangedAt(LocalDateTime.of(2026, 10, 10, 9, 15));
        RequestStatusHistory pending = new RequestStatusHistory(d.r2, RequestStatus.PENDING, d.u1,
                "ส่งคำร้องพร้อมรูปภาพ 2 รูป");
        pending.setChangedAt(LocalDateTime.of(2026, 10, 10, 8, 40));
        em.persist(inProgress);
        em.persist(pending);
        em.flush();
        em.clear();

        List<RequestStatusHistory> result =
                repo.findByRepairRequestRequestIdOrderByChangedAtAsc(d.r2.getRequestId());

        assertThat(result)
                .extracting(RequestStatusHistory::getStatus)
                .containsExactly(RequestStatus.PENDING, RequestStatus.IN_PROGRESS);
    }

    @Test
    void UT_DAO_18_timeline_noHistory_returnsEmptyList() {
        List<RequestStatusHistory> result =
                repo.findByRepairRequestRequestIdOrderByChangedAtAsc(d.r3.getRequestId());

        assertThat(result).isNotNull().isEmpty();
    }

    @Test
    void UT_DAO_35_save_completedStatus_withRepairNote() {
        RequestStatusHistory h = new RequestStatusHistory(
                d.r1020, RequestStatus.COMPLETED, d.tech03, "เปลี่ยนท่อน้ำทิ้งใหม่ ใช้งานได้ปกติ");

        RequestStatusHistory saved = repo.saveAndFlush(h);
        em.clear();

        RequestStatusHistory reloaded = repo.findById(saved.getHistoryId()).orElseThrow();
        assertThat(reloaded.getHistoryId()).isNotNull();
        assertThat(reloaded.getStatus()).isEqualTo(RequestStatus.COMPLETED);
        assertThat(reloaded.getNote()).isEqualTo("เปลี่ยนท่อน้ำทิ้งใหม่ ใช้งานได้ปกติ");
        assertThat(reloaded.getChangedBy().getUserId()).isEqualTo(d.tech03.getUserId());
        assertThat(reloaded.getChangedAt()).isNotNull();
    }
}
