package com.cs261_650001_group3.dorm_repair.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ImageStorageService {

    public static final int MAX_IMAGES = 3;
    public static final long MAX_SIZE = 5L * 1024 * 1024;   // 5MB
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png");

    private final Path uploadDir = Paths.get("uploads");

    /** เช็กรูปทั้งชุด: ไม่เกิน 3 รูป รูปละไม่เกิน 5MB เป็น jpg/png */
    public void validateAll(List<MultipartFile> files) {
        if (files == null) {
            return;
        }
        if (files.size() > MAX_IMAGES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "แนบรูปได้ไม่เกิน 3 รูป");
        }
        files.forEach(this::validate);
    }

    public void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาแนบไฟล์รูปภาพ");
        }
        if (file.getSize() > MAX_SIZE || !ALLOWED_TYPES.contains(file.getContentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "รูปต้องเป็น jpg หรือ png และไม่เกิน 5MB");
        }
    }

    /** บันทึกรูปแล้วคืน URL เช่น store(file, "1025-1") → "/uploads/1025-1.jpg" */
    public String store(MultipartFile file, String baseName) {
        validate(file);
        String ext = "image/png".equals(file.getContentType()) ? ".png" : ".jpg";
        String fileName = baseName + ext;
        try (InputStream in = file.getInputStream()) {
            Files.createDirectories(uploadDir);
            Files.copy(in, uploadDir.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปไม่สำเร็จ", e);
        }
        return "/uploads/" + fileName;
    }
}