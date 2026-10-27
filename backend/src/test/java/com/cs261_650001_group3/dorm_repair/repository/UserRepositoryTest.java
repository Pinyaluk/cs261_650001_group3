package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.RepairCategory;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.entity.User;
import jakarta.persistence.PersistenceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit test ของ UserRepository: UT-DAO-01 ถึง 04 และ UT-DAO-22 ถึง 23
 * ใช้ H2 ในหน่วยความจำ ไม่ต้องเปิด Docker ทุก test rollback เองเมื่อจบ
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class UserRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired UserRepository repo;

    TestData d;

    @BeforeEach
    void setUp() {
        d = TestData.seed(em);
    }

    @Test
    void UT_DAO_01_save_newUser() {
        User saved = repo.saveAndFlush(
                TestData.user("resident04", "ชูใจ ใหม่", Role.RESIDENT, "D-401", "084-567-8901"));

        assertThat(saved.getUserId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void UT_DAO_02_findByUsername_found() {
        em.clear();   // ให้อ่านจาก DB จริง ไม่ใช่จาก cache

        Optional<User> result = repo.findByUsername("resident01");

        assertThat(result).isPresent();
        User u = result.get();
        assertThat(u.getUserId()).isEqualTo(d.u1.getUserId());
        assertThat(u.getRole()).isEqualTo(Role.RESIDENT);
        assertThat(u.getRoomNumber()).isEqualTo("A-305");
        assertThat(u.getFullName()).isEqualTo("สมชาย ใจดี");
    }

    @Test
    void UT_DAO_03_findByUsername_notFound() {
        assertThat(repo.findByUsername("nobody99")).isEmpty();
    }

    @Test
    void UT_DAO_04_save_duplicateUsername_fails() {
        User duplicate = TestData.user("resident01", "คนละคน", Role.RESIDENT, "D-402", "085-678-9012");

        assertThatThrownBy(() -> repo.saveAndFlush(duplicate))
                .isInstanceOfAny(DataIntegrityViolationException.class, PersistenceException.class);
    }

    @Test
    void UT_DAO_22_findByRoleAndSpecialty_found() {
        em.clear();
        List<User> result = repo.findByRoleAndSpecialty(Role.TECHNICIAN, RepairCategory.ELECTRICAL);

        assertThat(result).hasSize(2);
        assertThat(result)
                .extracting(User::getUsername)
                .containsExactlyInAnyOrder("tech01", "tech02");
        assertThat(result).allMatch(u -> u.getRole() == Role.TECHNICIAN
                && u.getSpecialty() == RepairCategory.ELECTRICAL);
    }

    @Test
    void UT_DAO_23_findByRoleAndSpecialty_doesNotReturnOtherRoles() {
        User staff99 = TestData.user("staff99", "เจ้าหน้าที่ท่อ", Role.STAFF, null, "02-555-9999");
        staff99.setSpecialty(RepairCategory.PLUMBING);
        em.persist(staff99);
        em.flush();
        em.clear();

        List<User> result = repo.findByRoleAndSpecialty(Role.TECHNICIAN, RepairCategory.PLUMBING);

        assertThat(result)
                .extracting(User::getUsername)
                .containsExactlyInAnyOrder("tech03", "tech04");
        assertThat(result).noneMatch(u -> "staff99".equals(u.getUsername()));
    }
}
