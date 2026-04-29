package com.example.web_project.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.web_project.entity.InventoryLog;

@Repository
public interface InventoryLogRepository extends JpaRepository<InventoryLog, Integer> {
    // Lấy nhật ký của một sản phẩm cụ thể
    List<InventoryLog> findByProduct_ProductIdOrderByCreatedAtDesc(Integer productId);

    // Lấy toàn bộ nhật ký 
    List<InventoryLog> findAllByOrderByCreatedAtDesc();
}