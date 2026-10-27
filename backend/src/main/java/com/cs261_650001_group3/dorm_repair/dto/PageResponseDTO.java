package com.cs261_650001_group3.dorm_repair.dto;

import java.util.List;

import org.springframework.data.domain.Page;

/**
 * รูปแบบตอบกลับแบบแบ่งหน้าตาม API spec Sprint 2 (ข้อ 2.1, 2.6)
 * { content, page, size, totalCount, totalPages }
 * ไม่ส่ง Page ของ Spring ตรงๆ เพราะ JSON จะมีฟิลด์เกินและชื่อไม่ตรง spec
 */
public record PageResponseDTO<T>(
        List<T> content,
        int page,
        int size,
        long totalCount,
        int totalPages
) {
    public static <T> PageResponseDTO<T> of(Page<T> p) {
        return new PageResponseDTO<>(p.getContent(), p.getNumber(), p.getSize(),
                p.getTotalElements(), p.getTotalPages());
    }
}
