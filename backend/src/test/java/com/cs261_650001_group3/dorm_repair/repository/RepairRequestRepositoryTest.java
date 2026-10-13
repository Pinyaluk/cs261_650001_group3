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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit test ของ RepairRequestRepository: UT-DAO-05 ถึง 13 และ 19 ถึง 21
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
                .containsExactly(d.r4.getRequestId());
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
        assertThat(r.getTechnician().getUsername()).isEqualTo("tech01");
    }

    @Test
    void UT_DAO_21_findOthersDetail_returnsEmpty() {
        Optional<RepairRequest> result =
                repo.findByRequestIdAndResidentUserId(d.r4.getRequestId(), d.u1.getUserId());

        assertThat(result).isEmpty();
    }
}
