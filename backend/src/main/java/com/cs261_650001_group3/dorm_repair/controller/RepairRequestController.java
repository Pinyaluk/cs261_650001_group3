package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.service.RepairRequestService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/repair-requests")
public class RepairRequestController {

    private final RepairRequestService repairRequestService;

    public RepairRequestController(RepairRequestService repairRequestService) {
        this.repairRequestService = repairRequestService;
    }

    // U3: รายการคำร้องของผู้ใช้ที่ login (ดึงจาก DB)
    // TODO: เมื่อ Login ของ BE4 เสร็จ เปลี่ยนจาก X-User-Id เป็น userId จาก token
    //       ตอนนี้ถ้าไม่ส่ง header มา = ผู้ใช้ 1 (resident01 สมชาย)
    @GetMapping("/my")
    public List<RepairRequestSummaryDTO> getMyRequests(
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {
        return repairRequestService.getMyRequests(userId);
    }

    // U3: รายละเอียดคำร้อง รูป และประวัติสถานะ (ดึงจาก DB) ไม่ใช่ของตัวเอง → 404
    @GetMapping("/{id}")
    public RepairRequestResponseDTO getById(
            @PathVariable("id") Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {
        return repairRequestService.getRequestDetail(id, userId);
    }
}
