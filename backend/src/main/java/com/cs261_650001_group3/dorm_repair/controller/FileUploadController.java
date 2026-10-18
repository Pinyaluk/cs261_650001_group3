package com.cs261_650001_group3.dorm_repair.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.cs261_650001_group3.dorm_repair.service.ImageStorageService;

@RestController
@RequestMapping("/api/upload")
public class FileUploadController {

    private final ImageStorageService imageStorageService;

    // Inject ImageStorageService เข้ามาใช้งานแทนการเขียนโค้ดบันทึกไฟล์เองแบบเดิม
    public FileUploadController(ImageStorageService imageStorageService) {
        this.imageStorageService = imageStorageService;
    }

    @PostMapping("/image")
    public ResponseEntity<String> uploadImage(@RequestParam("file") MultipartFile file) {
        // เรียกใช้งาน Service กลางเพื่อเช็กและบันทึกไฟล์ พร้อมสร้างชื่อไฟล์สุ่มด้วย UUID
        String url = imageStorageService.store(file, java.util.UUID.randomUUID().toString());
        
        return ResponseEntity.ok(url);
    }
}