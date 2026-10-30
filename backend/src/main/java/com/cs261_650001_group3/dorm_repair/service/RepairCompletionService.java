package com.cs261_650001_group3.dorm_repair.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.cs261_650001_group3.dorm_repair.dto.CompleteRepairResponseDTO;
import com.cs261_650001_group3.dorm_repair.entity.ImageType;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatusHistory;
import com.cs261_650001_group3.dorm_repair.entity.User;
import com.cs261_650001_group3.dorm_repair.repository.RepairRequestRepository;

/**
 * U8 ช่างส่งมอบงาน ตาม API spec Sprint 2 ข้อ 2.7
 *
 * ผลการซ่อมเก็บเป็น note ของประวัติสถานะ COMPLETED (ไม่มีคอลัมน์แยกใน DB) ความยาว note ใน DB = 500
 * ตรวจ input ทั้งหมดก่อนบันทึกไฟล์ เพื่อไม่ให้มีไฟล์ค้างเมื่อตอบ error
 */
@Service
public class RepairCompletionService {

    /** ความยาวคอลัมน์ note ของ request_status_history */
    private static final int MAX_RESULT_LENGTH = 500;

    private final RepairRequestRepository repairRequestRepository;
    private final ImageStorageService imageStorageService;

    public RepairCompletionService(RepairRequestRepository repairRequestRepository,
                                   ImageStorageService imageStorageService) {
        this.repairRequestRepository = repairRequestRepository;
        this.imageStorageService = imageStorageService;
    }

    /**
     * 400: ผลการซ่อมว่างหรือยาวเกิน 500, ไม่มีรูป / เกิน 3 รูป / เกิน 5MB / ไม่ใช่ jpg-png,
     *      คำร้องไม่ใช่ IN_PROGRESS, ช่างไม่ใช่ผู้ได้รับมอบหมาย
     * 404: ไม่พบคำร้อง
     */
    @Transactional
    public CompleteRepairResponseDTO complete(Long requestId, String repairResult,
                                              List<MultipartFile> afterImages, User technician) {
        String result = (repairResult == null) ? "" : repairResult.trim();
        if (result.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาระบุผลการซ่อม");
        }
        if (result.length() > MAX_RESULT_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "ผลการซ่อมยาวเกิน " + MAX_RESULT_LENGTH + " ตัวอักษร");
        }
        if (afterImages == null || afterImages.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาแนบรูปหลังซ่อมอย่างน้อย 1 รูป");
        }
        imageStorageService.validateAll(afterImages);

        RepairRequest r = repairRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบคำร้อง"));
        if (r.getStatus() != RequestStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "ส่งมอบงานได้เฉพาะคำร้องที่สถานะกำลังดำเนินการ (IN_PROGRESS)");
        }
        if (r.getTechnician() == null || !r.getTechnician().getUserId().equals(technician.getUserId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "คุณไม่ใช่ช่างที่ได้รับมอบหมายงานนี้");
        }

        List<String> urls = new ArrayList<>();
        int i = 1;
        for (MultipartFile f : afterImages) {
            String url = imageStorageService.store(f, requestId + "-after-" + i++);
            r.addImage(url, f.getSize(), ImageType.AFTER);
            urls.add(url);
        }
        r.changeStatus(RequestStatus.COMPLETED, technician, result);

        // flush เพื่อให้ประวัติได้ changedAt (@PrePersist) ก่อนสร้าง response
        repairRequestRepository.saveAndFlush(r);

        List<RequestStatusHistory> history = r.getStatusHistory();
        return new CompleteRepairResponseDTO(
                r.getRequestId(),
                r.getStatus().name(),
                result,
                urls,
                history.get(history.size() - 1).getChangedAt());
    }
}
