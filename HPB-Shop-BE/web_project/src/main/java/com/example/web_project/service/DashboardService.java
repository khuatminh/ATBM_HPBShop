package com.example.web_project.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.web_project.entity.Order;
import com.example.web_project.repository.OrderRepository;
import com.example.web_project.repository.ProductRepository;
import com.example.web_project.repository.UserRepository;

@Service
public class DashboardService {
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ProductRepository productRepository;

        public Map<String, Object> getDashboardData(String period) {
        Map<String, Object> data = new HashMap<>();
                LocalDateTime now = LocalDateTime.now();
                LocalDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
                LocalDateTime periodStart = resolvePeriodStart(period, now);

        BigDecimal monthlyRevenue = orderRepository.findByStatus("completed").stream()
                .filter(o -> o.getCreatedAt().isAfter(startOfMonth))
                .map(Order::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

                BigDecimal revenueByPeriod = orderRepository.findByStatusAndCreatedAtAfter("completed", periodStart).stream()
                                .map(Order::getTotalPrice)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        long newOrders = orderRepository.findAll().stream()
                .filter(o -> o.getCreatedAt().isAfter(startOfMonth)).count();
        
        long newCustomers = userRepository.findByRole("customer").stream()
                .filter(u -> u.getCreatedAt().isAfter(startOfMonth)).count();
        
        long totalOrders = orderRepository.count();
        long cancelledOrders = orderRepository.countByStatus("cancelled");
        double cancelRate = totalOrders > 0 ? (double) cancelledOrders / totalOrders * 100 : 0;

        data.put("monthlyRevenue", monthlyRevenue);
                data.put("revenueByPeriod", revenueByPeriod);
                data.put("period", normalizePeriod(period));
        data.put("newOrders", newOrders);
        data.put("newCustomers", newCustomers);
        data.put("cancelRate", Math.round(cancelRate * 10.0) / 10.0);

        //Biểu đồ & Danh sách
        data.put("latestOrders", orderRepository.findTop5ByOrderByCreatedAtDesc());
        data.put("lowStockProducts", productRepository.findByStockLessThan(5));
                data.put("revenueChart", orderRepository.getRevenueLast7Days(periodStart));
        data.put("brandChart", orderRepository.getSalesByBrand());

        return data;
    }

        private String normalizePeriod(String period) {
                String safePeriod = period == null ? "month" : period.toLowerCase();
                if ("day".equals(safePeriod) || "week".equals(safePeriod) || "month".equals(safePeriod)) {
                        return safePeriod;
                }
                return "month";
        }

        private LocalDateTime resolvePeriodStart(String period, LocalDateTime now) {
                String safePeriod = normalizePeriod(period);
                if ("day".equals(safePeriod)) {
                        return LocalDate.now().atStartOfDay();
                }
                if ("week".equals(safePeriod)) {
                        return LocalDate.now().minusDays(6).atStartOfDay();
                }
                return now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        }
}