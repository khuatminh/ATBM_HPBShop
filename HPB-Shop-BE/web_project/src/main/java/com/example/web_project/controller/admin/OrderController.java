package com.example.web_project.controller.admin;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.entity.Order;
import com.example.web_project.service.OrderService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Admin - Đơn hàng", description = "Quản lý đơn hàng và doanh thu")
@RestController
@RequestMapping("/api/admin/orders")
@CrossOrigin("*")
public class OrderController {

    @Autowired
    private OrderService orderService;

    // Lấy toàn bộ danh sách đơn hàng
    @Operation(summary = "Lấy danh sách đơn hàng")
    @GetMapping
    public List<Order> getOrders(@RequestParam(required = false) String status) {
        if (status != null && !status.isEmpty() && !status.equalsIgnoreCase("all")) {
            return orderService.getOrdersByStatus(status);
        }
        return orderService.getAllOrders();
    }

    // Cập nhật trạng thái ("Duyệt" hoặc "Hủy")
    @Operation(summary = "Cập nhật trạng thái đơn hàng (Duyệt/Hủy/Giao)")
    @PutMapping("/{id}/status")
    public Order updateStatus(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        String newStatus = body.get("status");
        return orderService.updateStatus(id, newStatus);
    }

    // API lấy con số thống kê cho các thẻ màu sắc trên Dashboard
    @Operation(summary = "Lấy số liệu thống kê đơn hàng")
    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        return orderService.getOrderStats();
    }
}