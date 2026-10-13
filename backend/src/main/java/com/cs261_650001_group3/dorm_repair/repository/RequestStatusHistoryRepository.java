package com.cs261_650001_group3.dorm_repair.repository;

import com.cs261_650001_group3.dorm_repair.entity.RequestStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** DAO ของประวัติสถานะ */
@Repository
public interface RequestStatusHistoryRepository extends JpaRepository<RequestStatusHistory, Long> {

    /** U3: timeline ของคำร้อง 1 ใบ เรียงเก่าไปใหม่ */
    List<RequestStatusHistory> findByRepairRequestRequestIdOrderByChangedAtAsc(Long requestId);
}
