package com.cs261_650001_group3.dorm_repair.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

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

import com.cs261_650001_group3.dorm_repair.dto.AssignTechnicianRequestDTO;
import com.cs261_650001_group3.dorm_repair.dto.AssignTechnicianResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.TechnicianAvailabilityDTO;
import com.cs261_650001_group3.dorm_repair.entity.LocationType;
import com.cs261_650001_group3.dorm_repair.entity.RepairCategory;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatusHistory;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.entity.TimeSlot;
import com.cs261_650001_group3.dorm_repair.entity.Urgency;
import com.cs261_650001_group3.dorm_repair.entity.User;

/**
 * Unit test ของ Task46 U6: API รายชื่อช่าง (2.5) และมอบหมายงาน (2.4)
 * ใช้ H2 ในหน่วยความจำ ไม่ต้องเปิด Docker
 * วันที่ใช้แบบนับจากวันนี้ เพื่อให้ test ยังผ่านเมื่อรันในอนาคต (วันนัดต้องไม่เป็นอดีต)
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import(TechnicianAssignmentService.class)
class TechnicianAssignmentServiceTest {

    /** วันที่ผู้พักอาศัยเสนอช่วงที่ 1 (เช้า) */
    static final LocalDate DAY1 = LocalDate.now().plusDays(30);
    /** วันที่ผู้พักอาศัยเสนอช่วงที่ 2 (บ่าย) และวันที่ tech03 มีนัดอยู่แล้ว เหมือนคำร้อง #1021 ใน init.sql */
    static final LocalDate DAY2 = LocalDate.now().plusDays(32);

    @Autowired TestEntityManager em;
    @Autowired TechnicianAssignmentService service;

    User resident;
    User staff;
    User tech03;  // ช่างประปา มีนัด DAY2 บ่าย 2 งาน + เช้า 1 งาน
    User tech04;  // ช่างประปา ว่าง
    User tech05;  // ช่างไฟฟ้า

    RepairRequest pending;    // PLUMBING PENDING เสนอ DAY1 เช้า / DAY2 บ่าย (แบบ #1021)
    RepairRequest completed;  // PLUMBING COMPLETED ของ tech03 นัด DAY2 13:00 (ต้องไม่ถูกนับ)

    @BeforeEach
    void setUp() {
        resident = em.persist(user("resident02", "มานี มีสุข", Role.RESIDENT, null));
        staff = em.persist(user("staff01", "สุดา พรศรี", Role.STAFF, null));
        tech03 = em.persist(user("tech03", "ชาญชัย ท่อน้ำดี", Role.TECHNICIAN, RepairCategory.PLUMBING));
        tech04 = em.persist(user("tech04", "ประเสริฐ ประปาไทย", Role.TECHNICIAN, RepairCategory.PLUMBING));
        tech05 = em.persist(user("tech05", "วิชัย สายลม", Role.TECHNICIAN, RepairCategory.ELECTRICAL));

        pending = request("ชักโครกน้ำไหลไม่หยุด");
        pending.setPreferredSlot2(DAY2, TimeSlot.AFTERNOON);
        pending.addHistory(RequestStatus.PENDING, resident, "ส่งคำร้องพร้อมรูปภาพ 1 รูป");
        em.persist(pending);

        em.persist(inProgressOf(tech03, DAY2.atTime(13, 0)));   // แบบ #1019
        em.persist(inProgressOf(tech03, DAY2.atTime(14, 30)));  // แบบ #1020
        em.persist(inProgressOf(tech03, DAY2.atTime(9, 0)));    // ช่วงเช้า ไม่นับในช่วงบ่าย

        completed = inProgressOf(tech03, DAY2.atTime(13, 0));
        completed.setStatus(RequestStatus.COMPLETED);
        em.persist(completed);

        em.flush();
        em.clear();
    }

    // ---------- 2.5 GET /api/staff/technicians ----------

    @Test
    void technicians_plumbingAfternoon_countsOnlyInProgressInThatSlot() {
        List<TechnicianAvailabilityDTO> res = service.getTechnicians("PLUMBING", DAY2, "AFTERNOON");

        assertThat(res).extracting(TechnicianAvailabilityDTO::fullName)
                .containsExactly("ชาญชัย ท่อน้ำดี", "ประเสริฐ ประปาไทย");
        assertThat(res.get(0).appointmentCount()).isEqualTo(2);  // 13:00 + 14:30 (ไม่นับ COMPLETED และช่วงเช้า)
        assertThat(res.get(1).appointmentCount()).isEqualTo(0);
        assertThat(res.get(0).specialty()).isEqualTo("PLUMBING");
        assertThat(res.get(0).phone()).isEqualTo("089-555-tech03");
        assertThat(res.get(0).id()).isEqualTo(tech03.getUserId());
    }

    @Test
    void technicians_morningSlot_countsOnlyMorning() {
        List<TechnicianAvailabilityDTO> res = service.getTechnicians("PLUMBING", DAY2, "MORNING");
        assertThat(res.get(0).appointmentCount()).isEqualTo(1);
    }

    @Test
    void technicians_otherDay_isFree() {
        List<TechnicianAvailabilityDTO> res = service.getTechnicians("PLUMBING", DAY1, "AFTERNOON");
        assertThat(res).allMatch(t -> t.appointmentCount() == 0);
    }

    @Test
    void technicians_noFilter_returnsAllTechniciansWithZeroCount() {
        List<TechnicianAvailabilityDTO> res = service.getTechnicians(null, null, null);

        assertThat(res).extracting(TechnicianAvailabilityDTO::fullName)
                .containsExactly("ชาญชัย ท่อน้ำดี", "ประเสริฐ ประปาไทย", "วิชัย สายลม");
        assertThat(res).allMatch(t -> t.appointmentCount() == 0);
    }

    @Test
    void technicians_lowercaseValues_accepted() {
        assertThat(service.getTechnicians("plumbing", DAY2, "afternoon")).hasSize(2);
    }

    @Test
    void technicians_invalidParams_400() {
        assertStatus(() -> service.getTechnicians("PLUMBING", DAY2, null), HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.getTechnicians("PLUMBING", null, "MORNING"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.getTechnicians("PLUMBING", DAY2, "EVENING"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.getTechnicians("GARDEN", null, null), HttpStatus.BAD_REQUEST);
    }

    // ---------- 2.4 PUT /api/staff/repair-requests/{id}/assign ----------

    /** Test case 6 ของ U6: tech03 มีนัดซ้อน 2 งาน แต่ระบบไม่บล็อก เจ้าหน้าที่มอบหมายได้ */
    @Test
    void assign_preferredSlot2_doubleBookedTechnician_notBlocked() {
        AssignTechnicianResponseDTO res = service.assign(pending.getRequestId(),
                body(tech03, "URGENT", DAY2, "AFTERNOON", null), staff);

        assertThat(res.requestId()).isEqualTo(pending.getRequestId());
        assertThat(res.status()).isEqualTo("IN_PROGRESS");
        assertThat(res.urgency()).isEqualTo("URGENT");
        assertThat(res.technicianId()).isEqualTo(tech03.getUserId());
        assertThat(res.appointmentDate()).isEqualTo(DAY2);
        assertThat(res.appointmentSlot()).isEqualTo("AFTERNOON");
        assertThat(res.appointmentNote()).isNull();
        assertThat(res.updatedAt()).isNotNull();

        em.clear();
        RepairRequest saved = em.find(RepairRequest.class, pending.getRequestId());
        assertThat(saved.getStatus()).isEqualTo(RequestStatus.IN_PROGRESS);
        assertThat(saved.getTechnician().getUserId()).isEqualTo(tech03.getUserId());
        assertThat(saved.getAppointmentDateTime()).isEqualTo(DAY2.atTime(13, 0));
        assertThat(saved.getUrgency()).isEqualTo(Urgency.URGENT);

        // ตอนนี้ tech03 มีนัดช่วงบ่ายวันนั้น 3 งาน
        assertThat(service.getTechnicians("PLUMBING", DAY2, "AFTERNOON").get(0).appointmentCount()).isEqualTo(3);
    }

    @Test
    void assign_savesStatusHistoryByStaff() {
        service.assign(pending.getRequestId(), body(tech04, "NORMAL", DAY1, "MORNING", null), staff);

        em.clear();
        List<RequestStatusHistory> history = em.find(RepairRequest.class, pending.getRequestId()).getStatusHistory();
        assertThat(history).hasSize(2);
        RequestStatusHistory last = history.stream()
                .filter(h -> h.getStatus() == RequestStatus.IN_PROGRESS).findFirst().orElseThrow();
        assertThat(last.getChangedBy().getUserId()).isEqualTo(staff.getUserId());
        assertThat(last.getNote()).contains("ประเสริฐ ประปาไทย").contains("ช่วงเช้า");
        assertThat(last.getChangedAt()).isNotNull();
    }

    @Test
    void assign_preferredSlot1_morningSavedAt0900() {
        service.assign(pending.getRequestId(), body(tech04, "NORMAL", DAY1, "MORNING", null), staff);

        em.clear();
        assertThat(em.find(RepairRequest.class, pending.getRequestId()).getAppointmentDateTime())
                .isEqualTo(DAY1.atTime(9, 0));
    }

    @Test
    void assign_newDateWithNote_savesNote() {
        LocalDate newDay = LocalDate.now().plusDays(35);
        AssignTechnicianResponseDTO res = service.assign(pending.getRequestId(),
                body(tech04, "NORMAL", newDay, "MORNING", "  โทรตกลงกับผู้พักอาศัยแล้ว  "), staff);

        assertThat(res.appointmentNote()).isEqualTo("โทรตกลงกับผู้พักอาศัยแล้ว");
        em.clear();
        RepairRequest saved = em.find(RepairRequest.class, pending.getRequestId());
        assertThat(saved.getAppointmentNote()).isEqualTo("โทรตกลงกับผู้พักอาศัยแล้ว");
        assertThat(saved.getAppointmentDateTime()).isEqualTo(newDay.atTime(9, 0));
    }

    @Test
    void assign_newDateWithoutNote_400() {
        LocalDate newDay = LocalDate.now().plusDays(35);
        assertStatus(() -> service.assign(pending.getRequestId(),
                body(tech04, "NORMAL", newDay, "MORNING", null), staff), HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.assign(pending.getRequestId(),
                body(tech04, "NORMAL", newDay, "MORNING", "   "), staff), HttpStatus.BAD_REQUEST);
        // วันตรงกับช่วงที่ 1 แต่คนละช่วงเวลา = วันนัดใหม่
        assertStatus(() -> service.assign(pending.getRequestId(),
                body(tech04, "NORMAL", DAY1, "AFTERNOON", null), staff), HttpStatus.BAD_REQUEST);
    }

    @Test
    void assign_pastDate_400() {
        assertStatus(() -> service.assign(pending.getRequestId(),
                body(tech04, "NORMAL", LocalDate.now().minusDays(1), "MORNING", "นัดย้อนหลัง"), staff),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void assign_noteTooLong_400() {
        assertStatus(() -> service.assign(pending.getRequestId(),
                body(tech04, "NORMAL", DAY1, "MORNING", "ก".repeat(501)), staff), HttpStatus.BAD_REQUEST);
    }

    @Test
    void assign_requestNotPending_400() {
        assertStatus(() -> service.assign(completed.getRequestId(),
                body(tech03, "NORMAL", DAY2, "AFTERNOON", "นัดใหม่"), staff), HttpStatus.BAD_REQUEST);
    }

    @Test
    void assign_alreadyAssigned_400() {
        service.assign(pending.getRequestId(), body(tech04, "NORMAL", DAY1, "MORNING", null), staff);
        assertStatus(() -> service.assign(pending.getRequestId(),
                body(tech03, "NORMAL", DAY1, "MORNING", null), staff), HttpStatus.BAD_REQUEST);
    }

    @Test
    void assign_technicianSpecialtyMismatch_400() {
        assertStatus(() -> service.assign(pending.getRequestId(),
                body(tech05, "NORMAL", DAY1, "MORNING", null), staff), HttpStatus.BAD_REQUEST);
    }

    @Test
    void assign_notFound_404() {
        assertStatus(() -> service.assign(999_999L,
                body(tech03, "NORMAL", DAY1, "MORNING", null), staff), HttpStatus.NOT_FOUND);
        assertStatus(() -> service.assign(pending.getRequestId(),
                new AssignTechnicianRequestDTO(999_999L, "NORMAL", DAY1, "MORNING", null), staff),
                HttpStatus.NOT_FOUND);
        // id มีอยู่จริงแต่ไม่ใช่ช่าง
        assertStatus(() -> service.assign(pending.getRequestId(),
                new AssignTechnicianRequestDTO(resident.getUserId(), "NORMAL", DAY1, "MORNING", null), staff),
                HttpStatus.NOT_FOUND);
    }

    @Test
    void assign_missingOrInvalidFields_400() {
        Long id = pending.getRequestId();
        assertStatus(() -> service.assign(id, null, staff), HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.assign(id,
                new AssignTechnicianRequestDTO(null, "NORMAL", DAY1, "MORNING", null), staff), HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.assign(id, body(tech04, "NORMAL", null, "MORNING", null), staff),
                HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.assign(id, body(tech04, "NORMAL", DAY1, null, null), staff),
                HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.assign(id, body(tech04, "NORMAL", DAY1, "NIGHT", null), staff),
                HttpStatus.BAD_REQUEST);
        assertStatus(() -> service.assign(id, body(tech04, "HIGH", DAY1, "MORNING", null), staff),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void assign_failedValidation_leavesRequestPending() {
        assertStatus(() -> service.assign(pending.getRequestId(),
                body(tech05, "URGENT", DAY1, "MORNING", null), staff), HttpStatus.BAD_REQUEST);

        em.clear();
        RepairRequest r = em.find(RepairRequest.class, pending.getRequestId());
        assertThat(r.getStatus()).isEqualTo(RequestStatus.PENDING);
        assertThat(r.getTechnician()).isNull();
        assertThat(r.getUrgency()).isEqualTo(Urgency.NORMAL);
    }

    @Test
    void assign_urgencyOmitted_keepsResidentValue() {
        RepairRequest urgent = request("ท่อน้ำแตก");
        urgent.setUrgency(Urgency.URGENT);  // ผู้พักอาศัยติ๊ก "แจ้งว่าเร่งด่วน"
        urgent.addHistory(RequestStatus.PENDING, resident, "ส่งคำร้อง");
        em.persist(urgent);
        em.flush();

        AssignTechnicianResponseDTO res = service.assign(urgent.getRequestId(),
                body(tech04, null, DAY1, "MORNING", null), staff);
        assertThat(res.urgency()).isEqualTo("URGENT");
    }

    // ---------- helpers ----------

    private static void assertStatus(Runnable call, HttpStatus expected) {
        assertThatThrownBy(call::run)
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(expected);
    }

    private static AssignTechnicianRequestDTO body(User tech, String urgency, LocalDate date, String slot, String note) {
        return new AssignTechnicianRequestDTO(tech.getUserId(), urgency, date, slot, note);
    }

    private static User user(String username, String fullName, Role role, RepairCategory specialty) {
        User u = new User(username, "$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy", fullName, role);
        u.setSpecialty(specialty);
        u.setPhone("089-555-" + username);
        return u;
    }

    /** คำร้องประปาของ resident เสนอช่วงที่ 1 = DAY1 เช้า */
    private RepairRequest request(String title) {
        return new RepairRequest(resident, LocationType.COMMON_AREA, "อาคาร B", "ชั้น 1 · ห้องน้ำรวม",
                RepairCategory.PLUMBING, title, "รายละเอียดของ " + title,
                DAY1, TimeSlot.MORNING, "082-345-6789");
    }

    private RepairRequest inProgressOf(User tech, LocalDateTime appointment) {
        RepairRequest r = request("งานของ " + tech.getUsername() + " " + appointment);
        r.setStatus(RequestStatus.IN_PROGRESS);
        r.assignTechnician(tech);
        r.setAppointmentDateTime(appointment);
        return r;
    }
}
