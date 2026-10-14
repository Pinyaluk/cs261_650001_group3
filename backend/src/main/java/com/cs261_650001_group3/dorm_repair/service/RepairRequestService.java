package com.cs261_650001_group3.dorm_repair.service;

import com.cs261_650001_group3.dorm_repair.dto.ContactDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestImage;
import com.cs261_650001_group3.dorm_repair.entity.User;
import com.cs261_650001_group3.dorm_repair.repository.RepairRequestRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * U3 ตรวจสอบประวัติกับสถานะ: ดึงคำร้องจาก DB แล้วแปลงเป็น DTO ตาม API spec
 * ต้องมี @Transactional(readOnly = true) เพราะช่าง รูป และประวัติสถานะโหลดแบบ LAZY
 */
@Service
public class RepairRequestService {

    private final RepairRequestRepository repairRequestRepository;

    public RepairRequestService(RepairRequestRepository repairRequestRepository) {
        this.repairRequestRepository = repairRequestRepository;
    }

    /** GET /api/repair-requests/my : คำร้องของผู้ใช้ เรียงล่าสุดก่อน ไม่มีคำร้องได้ [] */
    @Transactional(readOnly = true)
    public List<RepairRequestSummaryDTO> getMyRequests(Long userId) {
        return repairRequestRepository.findByResidentUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toSummary)
                .toList();
    }

    /** GET /api/repair-requests/{id} : ไม่มีคำร้องนี้ หรือเป็นของคนอื่น → 404 */
    @Transactional(readOnly = true)
    public RepairRequestResponseDTO getRequestDetail(Long requestId, Long userId) {
        RepairRequest r = repairRequestRepository.findByRequestIdAndResidentUserId(requestId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบคำร้องนี้"));
        return toResponse(r);
    }

    // ---------- แปลง Entity → DTO ----------

    private RepairRequestSummaryDTO toSummary(RepairRequest r) {
        User tech = r.getTechnician();
        return new RepairRequestSummaryDTO(
                r.getRequestId(),
                r.getTitle(),
                r.getCategory().name(),
                r.getStatus().name(),
                tech != null ? tech.getFullName() : null,
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }

    private RepairRequestResponseDTO toResponse(RepairRequest r) {
        User tech = r.getTechnician();
        ContactDTO technician = (tech != null) ? new ContactDTO(tech.getFullName(), tech.getPhone()) : null;

        List<String> imageUrls = r.getImages().stream()
                .map(RequestImage::getFilePath)
                .toList();

        List<StatusHistoryDTO> history = r.getStatusHistory().stream()
                .map(h -> new StatusHistoryDTO(
                        h.getStatus().name(),
                        h.getNote(),
                        h.getChangedAt(),
                        h.getChangedBy().getFullName()))
                .toList();

        return new RepairRequestResponseDTO(
                r.getRequestId(),
                r.getLocationType().name(),
                r.getBuilding(),
                r.getLocationDetail(),
                r.getCategory().name(),
                r.getTitle(),
                r.getDescription(),
                r.getPreferredDate1(),
                r.getPreferredSlot1().name(),
                r.getPreferredDate2(),
                r.getPreferredSlot2() != null ? r.getPreferredSlot2().name() : null,
                r.getAppointmentDateTime(),
                r.getContactPhone(),
                r.getLineId(),
                r.getStatus().name(),
                r.getUrgency().name(),
                technician,
                imageUrls,
                history,
                r.getCreatedAt()
        );
    }
}
