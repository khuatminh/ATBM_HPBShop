package com.example.web_project.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.web_project.entity.InventoryLog;
import com.example.web_project.entity.Product;
import com.example.web_project.entity.User;
import com.example.web_project.repository.InventoryLogRepository;
import com.example.web_project.repository.ProductRepository;

import jakarta.transaction.Transactional;

@Service
public class InventoryLogService {

    @Autowired
    private InventoryLogRepository inventoryLogRepository;
    @Autowired
    private ProductRepository productRepository;

    // Lấy lịch sử và sắp xếp mới nhất lên đầu
    public List<InventoryLog> getAllLogs(Integer productId) {
        if (productId == null) {
            return inventoryLogRepository.findAllByOrderByCreatedAtDesc();
        }
        return inventoryLogRepository.findByProduct_ProductIdOrderByCreatedAtDesc(productId);
    }

    // Logic "Nhập hàng" - Chạy đồng thời 2 việc
    @Transactional
    public void importStock(Integer productId, Integer amount, String reason, User admin) {
        // Cập nhật số lượng trong bảng Products
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm"));
        product.setStock(product.getStock() + amount);
        productRepository.save(product);

        // Ghi nhật ký vào bảng Inventory_Logs
        InventoryLog log = new InventoryLog();
        log.setProduct(product);
        log.setAdmin(admin);
        log.setChangeAmount(amount);
        log.setReason(reason);
        inventoryLogRepository.save(log);
    }

    // Tính toán 3 con số cho Dashboard
    public Map<String, Object> getDashboardStats() {
        List<Product> products = productRepository.findAll();
        Map<String, Object> stats = new HashMap<>();
        
        stats.put("totalProducts", products.size());
        stats.put("totalStock", products.stream().mapToInt(Product::getStock).sum());
        stats.put("lowStockCount", products.stream().filter(p -> p.getStock() < 5).count());
        
        return stats;
    }
}