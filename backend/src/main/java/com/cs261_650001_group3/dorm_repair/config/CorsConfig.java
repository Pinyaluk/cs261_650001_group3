package com.cs261_650001_group3.dorm_repair.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        
        registry.addMapping("/**") 
                .allowedOrigins("http://localhost:3000") 
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }

    @Override
   public void addResourceHandlers(org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry registry) {
       // หาใน uploads/ ก่อน (รูปที่ผู้ใช้อัปโหลด) ไม่เจอค่อยใช้รูปตัวอย่างของข้อมูลใน init.sql ที่อยู่ใน resources/seed-uploads
       registry.addResourceHandler("/uploads/**").addResourceLocations("file:uploads/", "classpath:/seed-uploads/");
   }
}