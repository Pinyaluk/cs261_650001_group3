package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.ImageType;
import com.cs261_650001_group3.dorm_repair.entity.RequestImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** DAO ของรูปประกอบคำร้อง */
@Repository
public interface RequestImageRepository extends JpaRepository<RequestImage, Long> {

    /** U1, U3: รูปทั้งหมดของคำร้อง 1 ใบ */
    List<RequestImage> findByRepairRequestRequestId(Long requestId);

    /** U8: ดึงรูปภาพแยกตามคำร้องและประเภทภาพ (BEFORE / AFTER) */
    List<RequestImage> findByRepairRequestRequestIdAndImageType(Long requestId, ImageType imageType);
}
