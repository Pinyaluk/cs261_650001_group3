package com.cs261_650001_group3.dorm_repair.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.cs261_650001_group3.dorm_repair.dto.AssignTechnicianRequestDTO;
import com.cs261_650001_group3.dorm_repair.dto.AssignTechnicianResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.TechnicianAvailabilityDTO;
import com.cs261_650001_group3.dorm_repair.entity.RepairCategory;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.entity.TimeSlot;
import com.cs261_650001_group3.dorm_repair.entity.Urgency;
import com.cs261_650001_group3.dorm_repair.entity.User;
import com.cs261_650001_group3.dorm_repair.repository.RepairRequestRepository;
import com.cs261_650001_group3.dorm_repair.repository.UserRepository;

/**
 * U6 เจ้าหน้าที่ยืนยันวันนัดและมอบหมายงานให้ช่าง (Task46) ตาม API spec Sprint 2 ข้อ 2.4 และ 2.5
 *
 * ช่วงเวลาใช้เส้นแบ่ง 12:00 เหมือน Task42: ก่อน 12:00 = MORNING, ตั้งแต่ 12:00 = AFTERNOON
 * ตอนบันทึก MORNING = 09:00, AFTERNOON = 13:00 (TimeSlot.getStartHour)
 * นัดซ้อนไม่บล็อก: แค่ส่งจำนวนนัดให้เจ้าหน้าที่ตัดสินใจเอง (ข้อตกลงทีม 21 ต.ค. 2569)
 */
@Service
public class TechnicianAssignmentService {

    /** ความยาวคอลัมน์ appointment_note ใน DB */
    private static final int MAX_NOTE_LENGTH = 500;

    private final RepairRequestRepository repairRequestRepository;
    private final UserRepository userRepository;

    public TechnicianAssignmentService(RepairRequestRepository repairRequestRepository,
                                       UserRepository userRepository) {
        this.repairRequestRepository = repairRequestRepository;
        this.userRepository = userRepository;
    }

    // ---------- 2.5 GET /api/staff/technicians ----------

    /**
     * รายชื่อช่าง (กรองตามประเภทงานได้) พร้อมจำนวนนัด IN_PROGRESS ในวันและช่วงเวลาที่ส่งมา
     * category = null → ช่างทุกคน / date และ slot ต้องส่งมาคู่กัน ส่งมาอย่างเดียว → 400
     * ไม่ได้ส่ง date/slot → appointmentCount = 0
     */
    @Transactional(readOnly = true)
    public List<TechnicianAvailabilityDTO> getTechnicians(String category, LocalDate date, String slot) {
        RepairCategory specialty = (category == null || category.isBlank()) ? null : parseCategory(category);
        TimeSlot timeSlot = (slot == null || slot.isBlank()) ? null : parseSlot(slot);
        if ((date == null) != (timeSlot == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาส่ง date และ slot มาพร้อมกัน");
        }

        List<User> technicians = (specialty == null)
                ? userRepository.findByRole(Role.TECHNICIAN)
                : userRepository.findByRoleAndSpecialty(Role.TECHNICIAN, specialty);

        return technicians.stream()
                .sorted(Comparator.comparing(User::getUserId))
                .map(t -> new TechnicianAvailabilityDTO(
                        t.getUserId(),
                        t.getFullName(),
                        t.getSpecialty() != null ? t.getSpecialty().name() : null,
                        t.getPhone(),
                        date == null ? 0 : countAppointments(t.getUserId(), date, timeSlot)))
                .toList();
    }

    /** นับคำร้อง IN_PROGRESS ของช่างที่นัดอยู่ในช่วงนั้นของวัน (เช่น 13:00 และ 14:30 นับเป็นช่วงบ่ายทั้งคู่) */
    private long countAppointments(Long technicianId, LocalDate date, TimeSlot slot) {
        LocalDateTime start = (slot == TimeSlot.MORNING) ? date.atStartOfDay() : date.atTime(LocalTime.NOON);
        LocalDateTime end = (slot == TimeSlot.MORNING) ? date.atTime(11, 59, 59) : date.atTime(23, 59, 59);
        return repairRequestRepository.countByTechnicianUserIdAndStatusAndAppointmentDateTimeBetween(
                technicianId, RequestStatus.IN_PROGRESS, start, end);
    }

    // ---------- 2.4 PUT /api/staff/repair-requests/{id}/assign ----------

    /**
     * มอบหมายช่าง + ยืนยันวันนัด + ความเร่งด่วน ในคำขอเดียว แล้วเปลี่ยนสถานะ PENDING → IN_PROGRESS
     * 404: ไม่พบคำร้อง / ไม่พบช่าง (หรือ id นั้นไม่ใช่ช่าง)
     * 400: ข้อมูลไม่ครบหรือผิดรูปแบบ, คำร้องไม่ใช่ PENDING, ช่างประเภทไม่ตรง, วันนัดเป็นอดีต,
     *      วันนัดใหม่ไม่มีหมายเหตุ, หมายเหตุยาวเกิน 500 ตัวอักษร
     */
    @Transactional
    public AssignTechnicianResponseDTO assign(Long requestId, AssignTechnicianRequestDTO dto, User staff) {
        if (dto == null || dto.technicianId() == null || dto.appointmentDate() == null
                || dto.appointmentSlot() == null || dto.appointmentSlot().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "กรุณาระบุช่าง วันนัด และช่วงเวลาให้ครบถ้วน");
        }
        TimeSlot slot = parseSlot(dto.appointmentSlot());
        Urgency urgency = (dto.urgency() == null || dto.urgency().isBlank()) ? null : parseUrgency(dto.urgency());
        String note = (dto.appointmentNote() == null || dto.appointmentNote().isBlank())
                ? null : dto.appointmentNote().trim();
        if (note != null && note.length() > MAX_NOTE_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "หมายเหตุวันนัดยาวเกิน " + MAX_NOTE_LENGTH + " ตัวอักษร");
        }

        RepairRequest r = repairRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบคำร้อง"));
        if (r.getStatus() != RequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "มอบหมายได้เฉพาะคำร้องที่สถานะรอรับเรื่อง (PENDING)");
        }

        User technician = userRepository.findById(dto.technicianId())
                .filter(u -> u.getRole() == Role.TECHNICIAN)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบข้อมูลช่าง"));
        if (technician.getSpecialty() != r.getCategory()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ประเภทงานของช่างไม่ตรงกับคำร้อง");
        }

        LocalDate date = dto.appointmentDate();
        if (date.isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "วันนัดต้องไม่เป็นอดีต");
        }
        if (isNewAppointment(r, date, slot) && note == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "กำหนดวันนัดใหม่ต้องระบุหมายเหตุ (เช่น ตกลงกับผู้พักอาศัยทางโทรศัพท์แล้ว)");
        }

        r.assignTechnician(technician);
        r.setAppointmentDateTime(date.atTime(slot.getStartHour(), 0));
        r.setAppointmentNote(note);
        if (urgency != null) {
            r.setUrgency(urgency);
        }
        r.changeStatus(RequestStatus.IN_PROGRESS, staff,
                "มอบหมายงานให้ช่าง" + technician.getFullName() + " นัดวันที่ " + thaiDate(date)
                        + " " + thaiSlot(slot));

        // flush เพื่อให้ @PreUpdate ตั้ง updatedAt และประวัติได้ changedAt ก่อนสร้าง response
        repairRequestRepository.saveAndFlush(r);

        return new AssignTechnicianResponseDTO(
                r.getRequestId(),
                r.getStatus().name(),
                r.getUrgency().name(),
                technician.getUserId(),
                date,
                slot.name(),
                r.getAppointmentNote(),
                r.getUpdatedAt());
    }

    /** วันนัดใหม่ = ไม่ตรงกับช่วงที่ 1 และช่วงที่ 2 ที่ผู้พักอาศัยเสนอมา */
    private static boolean isNewAppointment(RepairRequest r, LocalDate date, TimeSlot slot) {
        boolean matches1 = date.equals(r.getPreferredDate1()) && slot == r.getPreferredSlot1();
        boolean matches2 = date.equals(r.getPreferredDate2()) && slot == r.getPreferredSlot2();
        return !matches1 && !matches2;
    }

    // ---------- แปลงค่าจากข้อความ (ค่าผิด → 400) ----------

    private static TimeSlot parseSlot(String value) {
        try {
            return TimeSlot.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ช่วงเวลาต้องเป็น MORNING หรือ AFTERNOON");
        }
    }

    private static Urgency parseUrgency(String value) {
        try {
            return Urgency.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ความเร่งด่วนต้องเป็น NORMAL หรือ URGENT");
        }
    }

    private static RepairCategory parseCategory(String value) {
        try {
            return RepairCategory.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ประเภทงานไม่ถูกต้อง");
        }
    }

    /** เช่น 30/11/2569 (ใช้ในข้อความประวัติสถานะที่ผู้พักอาศัยเห็นใน timeline) */
    private static String thaiDate(LocalDate d) {
        return d.getDayOfMonth() + "/" + d.getMonthValue() + "/" + (d.getYear() + 543);
    }

    private static String thaiSlot(TimeSlot slot) {
        return slot == TimeSlot.MORNING ? "ช่วงเช้า" : "ช่วงบ่าย";
    }
}
