package com.example.web_project.controller.admin;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.entity.InventoryLog;
import com.example.web_project.entity.Product;
import com.example.web_project.service.InventoryLogService;
import com.example.web_project.service.ProductService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Admin - Quản lý kho", description = "Vận hành kho hàng HPB Sports")
@RestController
@RequestMapping("/api/admin/inventory")
@CrossOrigin("*")
public class InventoryLogController {

    @Autowired
    private InventoryLogService inventoryLogService;
    @Autowired
    private ProductService productService; 

    // API cho 3 thẻ thống kê trên cùng 
    @Operation(summary = "Lấy số liệu 3 thẻ thống kê Dashboard")
    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        return inventoryLogService.getDashboardStats();
    }

    // API cho danh sách sản phẩm kèm trạng thái (Ổn định/Sắp hết)
    @Operation(summary = "Lấy danh sách sản phẩm trong kho")
    @GetMapping("/products")
    public List<Product> getInventoryProducts() {
        return productService.getAllProducts();
    }

    // "Lịch sử thay đổi kho" ở dưới cùng
    @Operation(summary = "Lấy lịch sử biến động kho")
    @GetMapping("/logs")
    public List<InventoryLog> getInventoryLogs() {
        return inventoryLogService.getAllLogs(null);
    }

    // nút "Nhập hàng"
    @Operation(summary = "Thực hiện nhập hàng mới vào kho")
    @PostMapping("/import")
    public ResponseEntity<?> doImport(@RequestBody Map<String, Object> payload) {
        Number productIdValue = (Number) payload.get("productId");
        Number amountValue = (Number) payload.get("amount");
        if (productIdValue == null || amountValue == null) {
            return ResponseEntity.badRequest().body("Thiếu productId hoặc amount");
        }

        Integer productId = productIdValue.intValue();
        Integer amount = amountValue.intValue();
        String reason = (String) payload.get("reason");
        
        inventoryLogService.importStock(productId, amount, reason, null);
        return ResponseEntity.ok("Nhập hàng thành công!");
    }
}