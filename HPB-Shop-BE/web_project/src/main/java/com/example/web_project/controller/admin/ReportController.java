package com.example.web_project.controller.admin;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.entity.Order;
import com.example.web_project.repository.OrderRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Admin - Báo cáo", description = "Thống kê doanh thu và kinh doanh")
@RestController
@RequestMapping("/api/admin/reports")
@CrossOrigin("*")
public class ReportController {

    @Autowired
    private OrderRepository orderRepository;

    // 1. Dữ liệu cho biểu đồ đường (7 ngày qua)
    @Operation(summary = "Doanh thu 7 ngày gần nhất")
    @GetMapping("/revenue-7-days")
    public List<Object[]> getRevenue7Days() {
        return orderRepository.getRevenueLast7Days(LocalDateTime.now().minusDays(7));
    }

    // 2. Dữ liệu cho biểu đồ tròn (Cơ cấu hãng)
    @Operation(summary = "Doanh thu theo thương hiệu")
    @GetMapping("/revenue-by-brand")
    public List<Object[]> getRevenueByBrand() {
        return orderRepository.getSalesByBrand();
    }

    // 3. Thống kê tổng quát cho các thẻ KPI
    @GetMapping("/kpi-summary")
    public Map<String, Object> getKPISummary() {
        LocalDateTime startOfMonth = LocalDateTime.now().withDayOfMonth(1).withHour(0).withMinute(0);
        
        // Tính doanh thu tháng này
        BigDecimal monthlyRevenue = orderRepository.findByStatusAndCreatedAtAfter("completed", startOfMonth)
                .stream()
                .map(Order::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> stats = new HashMap<>();
        stats.put("monthlyRevenue", monthlyRevenue);
        stats.put("newOrders", orderRepository.countByCreatedAtAfter(startOfMonth));
        stats.put("totalOrders", orderRepository.count());
        return stats;
    }
}