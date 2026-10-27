package com.cs261_650001_group3.dorm_repair.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.cs261_650001_group3.dorm_repair.dto.ContactDTO;
import com.cs261_650001_group3.dorm_repair.dto.CreateRepairRequestDTO; 
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestResponseDTO;
import com.cs261_650001_group3.dorm_repair.dto.RepairRequestSummaryDTO;
import com.cs261_650001_group3.dorm_repair.dto.StatusHistoryDTO;
import com.cs261_650001_group3.dorm_repair.entity.ImageType;
import com.cs261_650001_group3.dorm_repair.entity.RepairRequest;
import com.cs261_650001_group3.dorm_repair.entity.RequestImage;
import com.cs261_650001_group3.dorm_repair.entity.RequestStatus;
import com.cs261_650001_group3.dorm_repair.entity.User;
import com.cs261_650001_group3.dorm_repair.repository.RepairRequestRepository;
import com.cs261_650001_group3.dorm_repair.repository.UserRepository;

/**
 * U3 ตรวจสอบประวัติกับสถานะ: ดึงคำร้องจาก DB แล้วแปลงเป็น DTO ตาม API spec
 * ต้องมี @Transactional(readOnly = true) เพราะช่าง รูป และประวัติสถานะโหลดแบบ LAZY
 */
@Service
public class RepairRequestService {

    private final RepairRequestRepository repairRequestRepository;
    private final UserRepository userRepository; 
    private final ImageStorageService imageStorageService; 

    // อัปเดต Constructor ให้รองรับการ Inject Dependency ครบถ้วน
    public RepairRequestService(
            RepairRequestRepository repairRequestRepository,
            UserRepository userRepository,
            ImageStorageService imageStorageService) {
        this.repairRequestRepository = repairRequestRepository;
        this.userRepository = userRepository;
        this.imageStorageService = imageStorageService;
    }

    /** U1: สร้างใบแจ้งซ่อม (POST) พร้อมตรวจสอบและบันทึกรูปภาพ 1-3 รูป */
    @Transactional
    public RepairRequestResponseDTO createRequest(CreateRepairRequestDTO dto, List<MultipartFile> images, Long userId) {

        // 0. เช็กข้อมูลไม่ครบ -> 400 Bad Request
        if (dto.title() == null || dto.title().isBlank() ||
                dto.description() == null || dto.description().isBlank() ||
                dto.preferredDate1() == null || dto.locationType() == null ||
                dto.category() == null ||
                dto.building() == null || dto.building().isBlank() ||
                dto.locationDetail() == null || dto.locationDetail().isBlank() ||
                dto.contactPhone() == null || dto.contactPhone().isBlank() ||
                dto.preferredSlot1() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
        }

        // 0. เช็กความยาวไม่ให้เกินคอลัมน์ใน DB -> 400 (ถ้าปล่อยไป DB จะ error แล้วได้ 500)
        checkMaxLength(dto.title(), 100, "อุปกรณ์ที่ชำรุด");
        checkMaxLength(dto.building(), 50, "อาคาร");
        checkMaxLength(dto.locationDetail(), 100, "รายละเอียดสถานที่");
        checkMaxLength(dto.description(), 1000, "รายละเอียดปัญหา");
        checkMaxLength(dto.contactPhone(), 20, "เบอร์โทรศัพท์");
        checkMaxLength(dto.lineId(), 50, "LINE ID");

        // 0. ช่วงที่ 2 ต้องกรอกทั้งวันและช่วงเวลา หรือว่างทั้งคู่ -> 400
        if ((dto.preferredDate2() == null) != (dto.preferredSlot2() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณากรอกวันและช่วงเวลาที่สะดวกช่วงที่ 2 ให้ครบ");
        }

        // 0. เช็กวันที่ย้อนหลัง -> 400 Bad Request
        if (dto.preferredDate1().isBefore(java.time.LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "วันที่นัดหมายต้องไม่เป็นอดีต");
        }
        if (dto.preferredDate2() != null && dto.preferredDate2().isBefore(java.time.LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "วันที่นัดหมายต้องไม่เป็นอดีต");
        }

        // 1. ตรวจสอบความถูกต้องของรูปภาพทั้งหมด (บังคับ 1-3 รูป ตามที่ปรับใน ImageStorageService)
        imageStorageService.validateAll(images);

        // 2. ค้นหา User ผู้แจ้งจาก Database
        User resident = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบข้อมูลผู้ใช้งานระบบ"));

        // 3. สร้าง Entity และบันทึกลง Database ก่อนเพื่อให้ได้ requestId ออกมา
        RepairRequest r = new RepairRequest(
                resident,
                dto.locationType(),
                dto.building(),
                dto.locationDetail(),
                dto.category(),
                dto.title(),
                dto.description(),
                dto.preferredDate1(),
                dto.preferredSlot1(),
                dto.contactPhone()
                
        );

        // เซ็ตค่าพารามิเตอร์เพิ่มเติมผ่าน Setter ที่เพื่อนทำเตรียมไว้
        if (dto.preferredDate2() != null && dto.preferredSlot2() != null) {
            r.setPreferredSlot2(dto.preferredDate2(), dto.preferredSlot2());
        }
        if (dto.lineId() != null) {
            r.setLineId(dto.lineId());
        }
        if (dto.urgency() != null) {
            r.setUrgency(dto.urgency());
        }

        RepairRequest savedRequest = repairRequestRepository.save(r);

        // 4. วนลูปบันทึกไฟล์รูปภาพ (ไม่ต้องเช็ก null ซ้ำเพราะผ่าน validateAll มาแล้ว)
        int i = 1;
        for (MultipartFile f : images) {
            String url = imageStorageService.store(f, savedRequest.getRequestId() + "-" + i++);
            savedRequest.addImage(url, f.getSize());
        }

        // 5. บันทึกประวัติสถานะเริ่มต้น PENDING พร้อมระบุจำนวนรูปภาพ
        savedRequest.addHistory(RequestStatus.PENDING, resident, "สร้างคำร้องสำเร็จพร้อมรูปภาพ " + images.size() + " รูป");

        // 6. บันทึกรูปและประวัติลง DB ทันที ให้ changedAt มีค่าก่อนสร้าง response (ไม่งั้นจะได้ null)
        repairRequestRepository.saveAndFlush(savedRequest);

        // 7. แปลง Entity ที่บันทึกแล้วกลับเป็น ResponseDTO
        return toResponse(savedRequest);
    }

    /** ข้อความยาวเกินขนาดคอลัมน์ใน DB → 400 */
    private static void checkMaxLength(String value, int max, String fieldName) {
        if (value != null && value.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "ช่อง" + fieldName + " ยาวเกิน " + max + " ตัวอักษร");
        }
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
                r.getUpdatedAt(),
                r.getUrgency() != null ? r.getUrgency().name() : null,
                r.getLocationType() != null ? r.getLocationType().name() : null,
                r.getBuilding(),
                r.getLocationDetail(),
                r.getAppointmentDateTime()
        );
    }

    private RepairRequestResponseDTO toResponse(RepairRequest r) {
        User tech = r.getTechnician();
        ContactDTO technician = (tech != null) ? new ContactDTO(tech.getFullName(), tech.getPhone()) : null;

        List<String> imageUrls = r.getImages().stream()
                .filter(img -> img.getImageType() == ImageType.BEFORE)
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
