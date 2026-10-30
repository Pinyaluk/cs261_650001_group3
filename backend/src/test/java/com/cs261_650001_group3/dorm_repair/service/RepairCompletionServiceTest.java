package com.cs261_650001_group3.dorm_repair.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.cs261_650001_group3.dorm_repair.dto.CompleteRepairResponseDTO;
import com.cs261_650001_group3.dorm_repair.entity.ImageType;
import com.cs261_650001_group3.dorm_repair.entity.LocationType;
import com.cs261_650001_group3.dorm_repair.entity.RepairCategory;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatusHistory;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.entity.TimeSlot;
import com.cs261_650001_group3.dorm_repair.entity.User;

/**
 * Unit test ของ U8: ช่างส่งมอบงาน (API spec Sprint 2 ข้อ 2.7)
 * ใช้ H2 ในหน่วยความจำ ไม่ต้องเปิด Docker
 * ไฟล์รูปที่เทสสร้างจริงใน uploads/ ใช้ requestId ที่ไม่ซ้ำของจริง และลบทิ้งใน @AfterEach
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import({RepairCompletionService.class, ImageStorageService.class})
class RepairCompletionServiceTest {

    static final String RESULT = "เปลี่ยนท่อน้ำทิ้งใหม่ ใช้งานได้ปกติ";

    @Autowired TestEntityManager em;
    @Autowired RepairCompletionService service;

    User resident;
    User tech03;   // เจ้าของงาน
    User tech04;   // ช่างคนอื่น

    RepairRequest inProgress;  // IN_PROGRESS ของ tech03
    RepairRequest pending;     // ยังไม่ถูกมอบหมาย
    RepairRequest completed;   // COMPLETED แล้ว

    final List<Path> createdFiles = new ArrayList<>();

    @BeforeEach
    void setUp() {
        resident = em.persist(user("resident02", "มานี มีสุข", Role.RESIDENT));
        tech03 = em.persist(user("tech03", "ชาญชัย ท่อน้ำดี", Role.TECHNICIAN));
        tech04 = em.persist(user("tech04", "ประเสริฐ ประปาไทย", Role.TECHNICIAN));

        inProgress = request("ท่อน้ำทิ้งรั่ว");
        inProgress.setStatus(RequestStatus.IN_PROGRESS);
        inProgress.assignTechnician(tech03);
        inProgress.setAppointmentDateTime(LocalDate.now().plusDays(3).atTime(13, 0));
        inProgress.addHistory(RequestStatus.PENDING, resident, "ส่งคำร้องพร้อมรูปภาพ 1 รูป");
        em.persist(inProgress);

        pending = request("ก๊อกน้ำหลวม");
        em.persist(pending);

        completed = request("ชักโครกตัน");
        completed.setStatus(RequestStatus.COMPLETED);
        completed.assignTechnician(tech03);
        em.persist(completed);

        em.flush();
        em.clear();
    }

    @AfterEach
    void cleanUp() throws IOException {
        for (Path p : createdFiles) {
            Files.deleteIfExists(p);
        }
    }

    // ---------- TC1: ส่งมอบสำเร็จ ----------

    @Test
    void complete_withResultAndOneImage_changesToCompletedAndRecordsHistory() {
        Long id = inProgress.getRequestId();
        trackFiles(id, 1);

        CompleteRepairResponseDTO res = service.complete(id, RESULT, List.of(jpg("a")), tech03);
        em.flush();
        em.clear();

        assertThat(res.requestId()).isEqualTo(id);
        assertThat(res.status()).isEqualTo("COMPLETED");
        assertThat(res.repairResult()).isEqualTo(RESULT);
        assertThat(res.afterImageUrls()).containsExactly("/uploads/" + id + "-after-1.jpg");
        assertThat(res.completedAt()).isNotNull();

        RepairRequest saved = em.find(RepairRequest.class, id);
        assertThat(saved.getStatus()).isEqualTo(RequestStatus.COMPLETED);
        RequestStatusHistory last = saved.getStatusHistory().get(saved.getStatusHistory().size() - 1);
        assertThat(last.getStatus()).isEqualTo(RequestStatus.COMPLETED);
        assertThat(last.getNote()).isEqualTo(RESULT);
        assertThat(last.getChangedBy().getUserId()).isEqualTo(tech03.getUserId());
        assertThat(saved.getImages()).filteredOn(i -> i.getImageType() == ImageType.AFTER).hasSize(1);
    }

    @Test
    void complete_withThreePngImages_savesAllAfterImages() {
        Long id = inProgress.getRequestId();
        trackFiles(id, 3);

        CompleteRepairResponseDTO res = service.complete(id, RESULT, List.of(png("a"), png("b"), png("c")), tech03);

        assertThat(res.afterImageUrls()).containsExactly(
                "/uploads/" + id + "-after-1.png",
                "/uploads/" + id + "-after-2.png",
                "/uploads/" + id + "-after-3.png");
    }

    @Test
    void complete_resultIsTrimmed() {
        Long id = inProgress.getRequestId();
        trackFiles(id, 1);

        CompleteRepairResponseDTO res = service.complete(id, "  " + RESULT + "  ", List.of(jpg("a")), tech03);

        assertThat(res.repairResult()).isEqualTo(RESULT);
    }

    // ---------- TC2: ไม่มีผลการซ่อม หรือไม่มีรูป ----------

    @Test
    void complete_nullResult_returns400() {
        assertStatus(() -> service.complete(inProgress.getRequestId(), null, List.of(jpg("a")), tech03),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void complete_blankResult_returns400() {
        assertStatus(() -> service.complete(inProgress.getRequestId(), "   ", List.of(jpg("a")), tech03),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void complete_resultLongerThan500_returns400() {
        assertStatus(() -> service.complete(inProgress.getRequestId(), "ก".repeat(501), List.of(jpg("a")), tech03),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void complete_resultExactly500_isAccepted() {
        Long id = inProgress.getRequestId();
        trackFiles(id, 1);

        CompleteRepairResponseDTO res = service.complete(id, "ก".repeat(500), List.of(jpg("a")), tech03);

        assertThat(res.repairResult()).hasSize(500);
    }

    @Test
    void complete_nullImages_returns400() {
        assertStatus(() -> service.complete(inProgress.getRequestId(), RESULT, null, tech03),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void complete_emptyImageList_returns400() {
        assertStatus(() -> service.complete(inProgress.getRequestId(), RESULT, List.of(), tech03),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void complete_emptyImageFile_returns400() {
        MultipartFile empty = new MockMultipartFile("afterImages", "a.jpg", "image/jpeg", new byte[0]);
        assertStatus(() -> service.complete(inProgress.getRequestId(), RESULT, List.of(empty), tech03),
                HttpStatus.BAD_REQUEST);
    }

    // ---------- TC3: รูปเกิน 5MB หรือเกิน 3 รูป ----------

    @Test
    void complete_fourImages_returns400() {
        assertStatus(() -> service.complete(inProgress.getRequestId(), RESULT,
                List.of(jpg("a"), jpg("b"), jpg("c"), jpg("d")), tech03), HttpStatus.BAD_REQUEST);
    }

    @Test
    void complete_imageOver5MB_returns400() {
        MultipartFile big = new MockMultipartFile("afterImages", "big.jpg", "image/jpeg",
                new byte[(int) ImageStorageService.MAX_SIZE + 1]);
        assertStatus(() -> service.complete(inProgress.getRequestId(), RESULT, List.of(big), tech03),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void complete_imageExactly5MB_isAccepted() {
        Long id = inProgress.getRequestId();
        trackFiles(id, 1);
        MultipartFile exact = new MockMultipartFile("afterImages", "ok.jpg", "image/jpeg",
                new byte[(int) ImageStorageService.MAX_SIZE]);

        CompleteRepairResponseDTO res = service.complete(id, RESULT, List.of(exact), tech03);

        assertThat(res.status()).isEqualTo("COMPLETED");
    }

    @Test
    void complete_nonImageType_returns400() {
        MultipartFile pdf = new MockMultipartFile("afterImages", "a.pdf", "application/pdf", new byte[]{1, 2, 3});
        assertStatus(() -> service.complete(inProgress.getRequestId(), RESULT, List.of(pdf), tech03),
                HttpStatus.BAD_REQUEST);
    }

    // ---------- TC4: งานที่ไม่ใช่ของตน ----------

    @Test
    void complete_otherTechnician_returns400AndKeepsStatus() {
        Long id = inProgress.getRequestId();

        assertStatus(() -> service.complete(id, RESULT, List.of(jpg("a")), tech04), HttpStatus.BAD_REQUEST);

        em.clear();
        assertThat(em.find(RepairRequest.class, id).getStatus()).isEqualTo(RequestStatus.IN_PROGRESS);
    }

    // ---------- TC5: สถานะไม่ใช่ IN_PROGRESS ----------

    @Test
    void complete_pendingRequest_returns400() {
        assertStatus(() -> service.complete(pending.getRequestId(), RESULT, List.of(jpg("a")), tech03),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void complete_alreadyCompleted_returns400() {
        assertStatus(() -> service.complete(completed.getRequestId(), RESULT, List.of(jpg("a")), tech03),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void complete_twice_secondCallReturns400() {
        Long id = inProgress.getRequestId();
        trackFiles(id, 1);
        service.complete(id, RESULT, List.of(jpg("a")), tech03);
        em.flush();
        em.clear();

        assertStatus(() -> service.complete(id, RESULT, List.of(jpg("a")), tech03), HttpStatus.BAD_REQUEST);
    }

    // ---------- อื่นๆ ----------

    @Test
    void complete_unknownRequest_returns404() {
        assertStatus(() -> service.complete(999_999L, RESULT, List.of(jpg("a")), tech03), HttpStatus.NOT_FOUND);
    }

    // ---------- helpers ----------

    private static void assertStatus(Runnable call, HttpStatus expected) {
        assertThatThrownBy(call::run)
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(expected);
    }

    private static MultipartFile jpg(String name) {
        return new MockMultipartFile("afterImages", name + ".jpg", "image/jpeg", new byte[]{1, 2, 3});
    }

    private static MultipartFile png(String name) {
        return new MockMultipartFile("afterImages", name + ".png", "image/png", new byte[]{1, 2, 3});
    }

    /** จดไฟล์ uploads/<id>-after-<n>.* ที่คาดว่าจะถูกสร้าง เพื่อลบทิ้งหลังเทส */
    private void trackFiles(Long requestId, int count) {
        for (int n = 1; n <= count; n++) {
            createdFiles.add(Paths.get("uploads", requestId + "-after-" + n + ".jpg"));
            createdFiles.add(Paths.get("uploads", requestId + "-after-" + n + ".png"));
        }
    }

    private static User user(String username, String fullName, Role role) {
        User u = new User(username, "$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy", fullName, role);
        if (role == Role.TECHNICIAN) {
            u.setSpecialty(RepairCategory.PLUMBING);
        }
        u.setPhone("089-555-" + username);
        return u;
    }

    private RepairRequest request(String title) {
        return new RepairRequest(resident, LocationType.COMMON_AREA, "อาคาร B", "ชั้น 1 · ห้องน้ำรวม",
                RepairCategory.PLUMBING, title, "รายละเอียดของ " + title,
                LocalDate.now().plusDays(1), TimeSlot.MORNING, "082-345-6789");
    }
}
