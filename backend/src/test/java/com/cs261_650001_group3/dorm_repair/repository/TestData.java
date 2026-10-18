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
 * ตรงกับ database/init.sql แต่ไม่ใส่รูปและประวัติ ให้แต่ละ test ใส่เองตามที่ต้องใช้
 */
class TestData {

    /** BCrypt ของ password123 (ค่าเดียวกับ init.sql) */
    static final String PASSWORD_HASH = "$2a$10$IfFMvzGMkYTExJo7KIG9BeriXvFBEX7Mgpix/O0rIhD69GU2wrzUy";

    User u1;  // D-U1 สมชาย resident01
    User u2;  // D-U2 มานี resident02
    User u3;  // D-U3 ปิติ resident03 ไม่มีคำร้อง
    User u4;  // D-U4 สุดา staff01
    User u5;  // D-U5 วิชัย tech01

    RepairRequest r1;  // D-R1 #1024 ไฟห้องน้ำดับ PENDING
    RepairRequest r2;  // D-R2 #1019 ก๊อกน้ำอ่างล้างหน้ารั่ว IN_PROGRESS URGENT
    RepairRequest r3;  // D-R3 #1003 แอร์ไม่เย็น COMPLETED
    RepairRequest r4;  // D-R4 #987 บานพับตู้เสื้อผ้าหลุด COMPLETED ของ D-U2

    static TestData seed(TestEntityManager em) {
        TestData d = new TestData();
        d.u1 = em.persist(user("resident01", "สมชาย ใจดี", Role.RESIDENT, "A-305", "081-234-5678"));
        d.u2 = em.persist(user("resident02", "มานี มีสุข", Role.RESIDENT, "B-210", "082-345-6789"));
        d.u3 = em.persist(user("resident03", "ปิติ ชูใจ", Role.RESIDENT, "C-102", "083-456-7890"));
        d.u4 = em.persist(user("staff01", "สุดา พรศรี", Role.STAFF, null, "02-555-0180"));
        d.u5 = em.persist(user("tech01", "วิชัย สายลม", Role.TECHNICIAN, null, "089-555-0148"));

        d.r1 = request(d.u1, "อาคาร A", "ชั้น 3 · ห้อง 305", RepairCategory.ELECTRICAL, "ไฟห้องน้ำดับ",
                LocalDate.of(2026, 10, 14), TimeSlot.MORNING, "081-234-5678",
                LocalDateTime.of(2026, 10, 12, 10, 0));

        d.r2 = request(d.u1, "อาคาร A", "ชั้น 3 · ห้อง 305", RepairCategory.PLUMBING, "ก๊อกน้ำอ่างล้างหน้ารั่ว",
                LocalDate.of(2026, 10, 13), TimeSlot.MORNING, "081-234-5678",
                LocalDateTime.of(2026, 10, 10, 8, 40));
        d.r2.setPreferredSlot2(LocalDate.of(2026, 10, 14), TimeSlot.AFTERNOON);
        d.r2.setLineId("somchai305");
        d.r2.setStatus(RequestStatus.IN_PROGRESS);
        d.r2.setUrgency(Urgency.URGENT);
        d.r2.assignTechnician(d.u5);
        d.r2.setAppointmentDateTime(LocalDateTime.of(2026, 10, 14, 13, 0));

        d.r3 = request(d.u1, "อาคาร A", "ชั้น 3 · ห้อง 305", RepairCategory.AIR_CONDITIONER, "แอร์ไม่เย็น",
                LocalDate.of(2026, 9, 22), TimeSlot.MORNING, "081-234-5678",
                LocalDateTime.of(2026, 9, 20, 14, 0));
        d.r3.setStatus(RequestStatus.COMPLETED);
        d.r3.assignTechnician(d.u5);

        d.r4 = request(d.u2, "อาคาร B", "ชั้น 2 · ห้อง 210", RepairCategory.FURNITURE, "บานพับตู้เสื้อผ้าหลุด",
                LocalDate.of(2026, 9, 15), TimeSlot.AFTERNOON, "082-345-6789",
                LocalDateTime.of(2026, 9, 14, 9, 0));
        d.r4.setStatus(RequestStatus.COMPLETED);
        d.r4.assignTechnician(d.u5);

        em.persist(d.r1);
        em.persist(d.r2);
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

    /** คำร้องที่มีช่องบังคับครบ (locationType = ROOM) */
    static RepairRequest request(User resident, String building, String locationDetail, RepairCategory category,
                                 String title, LocalDate date1, TimeSlot slot1, String phone,
                                 LocalDateTime createdAt) {
        RepairRequest r = new RepairRequest(resident, LocationType.ROOM, building, locationDetail,
                category, title, "รายละเอียดของ " + title, date1, slot1, phone);
        r.setCreatedAt(createdAt);
        return r;
    }
}
