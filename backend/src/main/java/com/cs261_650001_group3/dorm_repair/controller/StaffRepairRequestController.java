package com.cs261_650001_group3.dorm_repair.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.cs261_650001_group3.dorm_repair.dto.AssignTechnicianRequestDTO;
import com.cs261_650001_group3.dorm_repair.dto.AssignTechnicianResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.PageResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.StaffRequestDetailDTO;
import com.cs261_650001_group3.dorm_repair.dto.StaffRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.Role;
import com.cs261_650001_group3.dorm_repair.entity.User;
import com.cs261_650001_group3.dorm_repair.service.AuthService;
import com.cs261_650001_group3.dorm_repair.service.RepairRequestService;
import com.cs261_650001_group3.dorm_repair.service.TechnicianAssignmentService;

/**
 * U4 เจ้าหน้าที่ตรวจสอบคำร้อง (Task42) ตาม API spec Sprint 2 ข้อ 2.1 และ 2.3
 * U6 มอบหมายงานให้ช่าง (Task46) ตาม API spec Sprint 2 ข้อ 2.4
 * ทุก endpoint ต้องส่ง header  Authorization: Bearer <token>
 */
@RestController
@RequestMapping("/api/staff/repair-requests")
public class StaffRepairRequestController {

    private final RepairRequestService repairRequestService;
    private final TechnicianAssignmentService assignmentService;
    private final AuthService authService;

    public StaffRepairRequestController(RepairRequestService repairRequestService,
                                        TechnicianAssignmentService assignmentService,
                                        AuthService authService) {
        this.repairRequestService = repairRequestService;
        this.assignmentService = assignmentService;
        this.authService = authService;
    }

    /**
     * PUT /api/staff/repair-requests/{id}/assign
     * มอบหมายช่าง + วันนัด + ความเร่งด่วน แล้วเปลี่ยนสถานะเป็น IN_PROGRESS
     * ไม่มี token → 401 / ไม่ใช่ STAFF → 403 / ข้อมูลไม่ถูกต้อง → 400 / ไม่พบคำร้องหรือช่าง → 404
     */
    @PutMapping("/{id}/assign")
    public AssignTechnicianResponseDTO assignTechnician(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) AssignTechnicianRequestDTO body) {
        User staff = authService.requireRole(authHeader, Role.STAFF);
        return assignmentService.assign(id, body, staff);
    }

    /**
     * GET /api/staff/repair-requests?page=0&size=10&status=PENDING
     * ไม่มี token → 401 / ไม่ใช่ STAFF → 403 / status ไม่ถูกต้อง → 400
     */
    @GetMapping
    public PageResponseDTO<StaffRequestSummaryDTO> getRequests(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size,
            @RequestParam(value = "status", required = false) String status) {
        authService.requireRole(authHeader, Role.STAFF);
        return repairRequestService.getStaffRequests(parseStatus(status), page, size);
    }

    /**
     * GET /api/staff/repair-requests/{id}
     * STAFF ดูได้ทุกใบ / TECHNICIAN ดูได้เฉพาะงานที่ได้รับมอบหมาย (ไม่ใช่ → 403) / ไม่พบ → 404
     */
    @GetMapping("/{id}")
    public StaffRequestDetailDTO getRequestDetail(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User viewer = authService.requireRole(authHeader, Role.STAFF, Role.TECHNICIAN);
        return repairRequestService.getStaffRequestDetail(id, viewer);
    }

    /** ไม่ส่ง status หรือส่งค่าว่าง = ทุกสถานะ */
    private static RequestStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return RequestStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "status ต้องเป็น PENDING, IN_PROGRESS หรือ COMPLETED");
        }
    }
}
