package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.RequestImage;
import jakarta.persistence.PersistenceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Unit test ของ RequestImageRepository: UT-DAO-14 และ 15 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class RequestImageRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired RequestImageRepository repo;

    TestData d;

    @BeforeEach
    void setUp() {
        d = TestData.seed(em);
    }

    @Test
    void UT_DAO_14_findImagesOfRequest_notMixed() {
        d.r1.addImage("/uploads/1024-1.jpg", 524_288);
        d.r1.addImage("/uploads/1024-2.jpg", 524_288);
        d.r1.addImage("/uploads/1024-3.jpg", 524_288);
        d.r4.addImage("/uploads/987-1.jpg", 398_336);
        em.flush();
        em.clear();

        List<RequestImage> result = repo.findByRepairRequestRequestId(d.r1.getRequestId());

        assertThat(result)
                .extracting(RequestImage::getFilePath)
                .containsExactlyInAnyOrder("/uploads/1024-1.jpg", "/uploads/1024-2.jpg", "/uploads/1024-3.jpg");
    }

    @Test
    void UT_DAO_15_save_imageWithoutRequest_fails() {
        RequestImage orphan = new RequestImage(null, "/uploads/x.jpg", 1_000);

        assertThatThrownBy(() -> repo.saveAndFlush(orphan))
                .isInstanceOfAny(DataIntegrityViolationException.class, PersistenceException.class);
    }
}
