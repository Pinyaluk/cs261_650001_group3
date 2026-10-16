package com.cs261_650001_group3.dorm_repair.controller;

import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.service.AuthService;
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
    private final AuthService authService;

    public RepairRequestController(RepairRequestService repairRequestService, AuthService authService) {
        this.repairRequestService = repairRequestService;
        this.authService = authService;
    }

   
    @GetMapping("/my")
    public List<RepairRequestSummaryDTO> getMyRequests(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = authService.requireUserId(authHeader);
        return repairRequestService.getMyRequests(userId);
    }

  
    @GetMapping("/{id}")
    public RepairRequestResponseDTO getById(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = authService.requireUserId(authHeader);
        return repairRequestService.getRequestDetail(id, userId);
    }
}