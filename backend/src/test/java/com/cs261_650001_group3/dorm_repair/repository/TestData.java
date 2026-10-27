package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.LocationType;
import com.cs261_650001_group3.dorm_repair.entity.RepairCategory;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.entity.TimeSlot;
import com.cs261_650001_group3.dorm_repair.entity.Urgency;
import com.cs261_650001_group3.dorm_repair.entity.User;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * ข้อมูลตั้งต้นของ unit test DAO (ตาราง "ข้อมูลตั้งต้น" ในเอกสาร Unit Test Design)
 * ตรงกับ database/init.sql Sprint 2 แต่ไม่ใส่รูปและประวัติ ให้แต่ละ test ใส่เองตามที่ต้องใช้
 */
class TestData {

    /** BCrypt ของ password123 (ค่าเดียวกับ init.sql) */
    static final String PASSWORD_HASH = "$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy";

    User u1;      // D-U1 สมชาย resident01
    User u2;      // D-U2 มานี resident02
    User u3;      // D-U3 ปิติ resident03 ไม่มีคำร้อง
    User u4;      // D-U4 สุดา staff01
    User u5;      // Alias ของ tech01 เพื่อความเข้ากันได้กับเทสเดิม Sprint 1

    User tech01;  // วิชัย สายลม (ELECTRICAL)
    User tech02;  // สมศักดิ์ วงจรดี (ELECTRICAL)
    User tech03;  // ชาญชัย ท่อน้ำดี (PLUMBING)
    User tech04;  // ประเสริฐ ประปาไทย (PLUMBING)
    User tech05;  // เกรียงไกร ลมเย็น (AIR_CONDITIONER)
    User tech06;  // อนุชา เย็นเจี๊ยบ (AIR_CONDITIONER)
    User tech07;  // บรรพต ไม้งาม (FURNITURE)
    User tech08;  // ธนกฤต ช่างไม้ (FURNITURE)
    User tech09;  // วีระ ช่างสารพัด (OTHER)
    User tech10;  // สุรศักดิ์ ซ่อมทั่วไทย (OTHER)

    RepairRequest r1;     // D-R1 #1024 ไฟห้องน้ำดับ PENDING (resident01)
    RepairRequest r1021;  // D-R1021 #1021 ชักโครกน้ำไหลไม่หยุด PENDING (resident02)
    RepairRequest r2;     // D-R2 #1019 ก๊อกน้ำอ่างล้างหน้ารั่ว IN_PROGRESS URGENT (tech03)
    RepairRequest r1020;  // D-R1020 #1020 ท่อน้ำทิ้งใต้อ่างรั่วซึม IN_PROGRESS NORMAL (tech03)
    RepairRequest r3;     // D-R3 #1003 แอร์ไม่เย็น COMPLETED (tech05)
    RepairRequest r4;     // D-R4 #987 บานพับตู้เสื้อผ้าหลุด COMPLETED (tech07 ของ resident02)

    static TestData seed(TestEntityManager em) {
        TestData d = new TestData();

        // ผู้พักอาศัย (1-3)
        d.u1 = em.persist(user("resident01", "สมชาย ใจดี", Role.RESIDENT, "A-305", "081-234-5678"));
        d.u2 = em.persist(user("resident02", "มานี มีสุข", Role.RESIDENT, "B-210", "082-345-6789"));
        d.u3 = em.persist(user("resident03", "ปิติ ชูใจ", Role.RESIDENT, "C-102", "083-456-7890"));

        // เจ้าหน้าที่ (4)
        d.u4 = em.persist(user("staff01", "สุดา พรศรี", Role.STAFF, null, "02-555-0180"));

        // ช่างซ่อมบำรุง 10 คน (5-14)
        d.tech01 = em.persist(technician("tech01", "วิชัย สายลม", RepairCategory.ELECTRICAL, "089-555-0101"));
        d.u5 = d.tech01; // สำหรับเทส Sprint 1
        d.tech02 = em.persist(technician("tech02", "สมศักดิ์ วงจรดี", RepairCategory.ELECTRICAL, "089-555-0102"));
        d.tech03 = em.persist(technician("tech03", "ชาญชัย ท่อน้ำดี", RepairCategory.PLUMBING, "089-555-0103"));
        d.tech04 = em.persist(technician("tech04", "ประเสริฐ ประปาไทย", RepairCategory.PLUMBING, "089-555-0104"));
        d.tech05 = em.persist(technician("tech05", "เกรียงไกร ลมเย็น", RepairCategory.AIR_CONDITIONER, "089-555-0105"));
        d.tech06 = em.persist(technician("tech06", "อนุชา เย็นเจี๊ยบ", RepairCategory.AIR_CONDITIONER, "089-555-0106"));
        d.tech07 = em.persist(technician("tech07", "บรรพต ไม้งาม", RepairCategory.FURNITURE, "089-555-0107"));
        d.tech08 = em.persist(technician("tech08", "ธนกฤต ช่างไม้", RepairCategory.FURNITURE, "089-555-0108"));
        d.tech09 = em.persist(technician("tech09", "วีระ ช่างสารพัด", RepairCategory.OTHER, "089-555-0109"));
        d.tech10 = em.persist(technician("tech10", "สุรศักดิ์ ซ่อมทั่วไทย", RepairCategory.OTHER, "089-555-0110"));

        // #1024: PENDING NORMAL (resident01)
        d.r1 = request(d.u1, LocationType.ROOM, "อาคาร A", "ชั้น 3 · ห้อง 305", RepairCategory.ELECTRICAL, "ไฟห้องน้ำดับ",
                LocalDate.of(2026, 11, 30), TimeSlot.MORNING, "081-234-5678",
                LocalDateTime.of(2026, 10, 12, 10, 0));

        // #1021: PENDING NORMAL (resident02, COMMON_AREA)
        d.r1021 = request(d.u2, LocationType.COMMON_AREA, "อาคาร B", "ชั้น 1 · ห้องน้ำรวม", RepairCategory.PLUMBING, "ชักโครกน้ำไหลไม่หยุด",
                LocalDate.of(2026, 11, 30), TimeSlot.AFTERNOON, "082-345-6789",
                LocalDateTime.of(2026, 10, 21, 9, 0));

        // #1019: IN_PROGRESS URGENT (resident01, tech03, นัด 30/11/2569 13:00)
        d.r2 = request(d.u1, LocationType.ROOM, "อาคาร A", "ชั้น 3 · ห้อง 305", RepairCategory.PLUMBING, "ก๊อกน้ำอ่างล้างหน้ารั่ว",
                LocalDate.of(2026, 11, 28), TimeSlot.MORNING, "081-234-5678",
                LocalDateTime.of(2026, 10, 10, 8, 40));
        d.r2.setPreferredSlot2(LocalDate.of(2026, 11, 30), TimeSlot.AFTERNOON);
        d.r2.setLineId("somchai305");
        d.r2.setStatus(RequestStatus.IN_PROGRESS);
        d.r2.setUrgency(Urgency.URGENT);
        d.r2.assignTechnician(d.tech03);
        d.r2.setAppointmentDateTime(LocalDateTime.of(2026, 11, 30, 13, 0));

        // #1020: IN_PROGRESS NORMAL (resident02, tech03, นัด 30/11/2569 14:30)
        d.r1020 = request(d.u2, LocationType.ROOM, "อาคาร B", "ชั้น 2 · ห้อง 210", RepairCategory.PLUMBING, "ท่อน้ำทิ้งใต้อ่างรั่วซึม",
                LocalDate.of(2026, 11, 30), TimeSlot.AFTERNOON, "082-345-6789",
                LocalDateTime.of(2026, 10, 11, 9, 0));
        d.r1020.setStatus(RequestStatus.IN_PROGRESS);
        d.r1020.assignTechnician(d.tech03);
        d.r1020.setAppointmentDateTime(LocalDateTime.of(2026, 11, 30, 14, 30));

        // #1003: COMPLETED NORMAL (resident01, tech05, นัด 22/09/2569 10:00)
        d.r3 = request(d.u1, LocationType.ROOM, "อาคาร A", "ชั้น 3 · ห้อง 305", RepairCategory.AIR_CONDITIONER, "แอร์ไม่เย็น",
                LocalDate.of(2026, 9, 22), TimeSlot.MORNING, "081-234-5678",
                LocalDateTime.of(2026, 9, 20, 14, 0));
        d.r3.setStatus(RequestStatus.COMPLETED);
        d.r3.assignTechnician(d.tech05);
        d.r3.setAppointmentDateTime(LocalDateTime.of(2026, 9, 22, 10, 0));

        // #987: COMPLETED NORMAL (resident02, tech07, นัด 16/09/2569 10:00)
        d.r4 = request(d.u2, LocationType.ROOM, "อาคาร B", "ชั้น 2 · ห้อง 210", RepairCategory.FURNITURE, "บานพับตู้เสื้อผ้าหลุด",
                LocalDate.of(2026, 9, 15), TimeSlot.AFTERNOON, "082-345-6789",
                LocalDateTime.of(2026, 9, 14, 9, 0));
        d.r4.setPreferredSlot2(LocalDate.of(2026, 9, 16), TimeSlot.MORNING);
        d.r4.setStatus(RequestStatus.COMPLETED);
        d.r4.assignTechnician(d.tech07);
        d.r4.setAppointmentDateTime(LocalDateTime.of(2026, 9, 16, 10, 0));

        em.persist(d.r1);
        em.persist(d.r1021);
        em.persist(d.r2);
        em.persist(d.r1020);
        em.persist(d.r3);
        em.persist(d.r4);
        em.flush();
        return d;
    }

    static User user(String username, String fullName, Role role, String room, String phone) {
        User u = new User(username, PASSWORD_HASH, fullName, role);
        u.setRoomNumber(room);
        u.setPhone(phone);
        return u;
    }

    static User technician(String username, String fullName, RepairCategory specialty, String phone) {
        User u = new User(username, PASSWORD_HASH, fullName, Role.TECHNICIAN);
        u.setSpecialty(specialty);
        u.setPhone(phone);
        return u;
    }

    /** คำร้องที่มีช่องบังคับครบ */
    static RepairRequest request(User resident, LocationType locationType, String building, String locationDetail,
                                 RepairCategory category, String title, LocalDate date1, TimeSlot slot1, String phone,
                                 LocalDateTime createdAt) {
        RepairRequest r = new RepairRequest(resident, locationType, building, locationDetail,
                category, title, "รายละเอียดของ " + title, date1, slot1, phone);
        r.setCreatedAt(createdAt);
        return r;
    }
}
