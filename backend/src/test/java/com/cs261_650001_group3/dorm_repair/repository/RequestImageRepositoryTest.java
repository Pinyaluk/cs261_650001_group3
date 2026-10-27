package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.ImageType;
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

/**
 * Unit test ของ RequestImageRepository:
 * Sprint 1: UT-DAO-14 และ 15
 * Sprint 2: UT-DAO-36 ถึง 39
 */
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

    @Test
    void UT_DAO_36_save_afterImage() {
        RequestImage img = new RequestImage(d.r1020, "/uploads/1020-after-1.jpg", 680_000, ImageType.AFTER);
        RequestImage saved = repo.saveAndFlush(img);
        em.clear();

        RequestImage reloaded = repo.findById(saved.getImageId()).orElseThrow();
        assertThat(reloaded.getImageId()).isNotNull();
        assertThat(reloaded.getImageType()).isEqualTo(ImageType.AFTER);
        assertThat(reloaded.getFilePath()).isEqualTo("/uploads/1020-after-1.jpg");
    }

    @Test
    void UT_DAO_37_findAfterImages_onlyAfter() {
        d.r3.addImage("/uploads/1003-1.jpg", 18_318, ImageType.BEFORE);
        d.r3.addImage("/uploads/1003-after.jpg", 18_318, ImageType.AFTER);
        em.flush();
        em.clear();

        List<RequestImage> result = repo.findByRepairRequestRequestIdAndImageType(d.r3.getRequestId(), ImageType.AFTER);

        assertThat(result)
                .extracting(RequestImage::getFilePath)
                .containsExactly("/uploads/1003-after.jpg");
    }

    @Test
    void UT_DAO_38_findBeforeImages_onlyBefore() {
        d.r4.addImage("/uploads/987-1.jpg", 17_359, ImageType.BEFORE);
        d.r4.addImage("/uploads/987-after.jpg", 17_359, ImageType.AFTER);
        em.flush();
        em.clear();

        List<RequestImage> result = repo.findByRepairRequestRequestIdAndImageType(d.r4.getRequestId(), ImageType.BEFORE);

        assertThat(result)
                .extracting(RequestImage::getFilePath)
                .containsExactly("/uploads/987-1.jpg");
    }

    @Test
    void UT_DAO_39_defaultImageType_isBefore() {
        RequestImage img = new RequestImage(d.r2, "/uploads/1019-3.jpg", 15_000);
        RequestImage saved = repo.saveAndFlush(img);
        em.clear();

        RequestImage reloaded = repo.findById(saved.getImageId()).orElseThrow();
        assertThat(reloaded.getImageType()).isEqualTo(ImageType.BEFORE);
    }
}
