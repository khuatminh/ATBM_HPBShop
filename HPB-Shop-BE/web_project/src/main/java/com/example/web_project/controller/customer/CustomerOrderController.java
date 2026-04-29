package com.example.web_project.controller.customer;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.entity.Order;
import com.example.web_project.repository.OrderRepository;
import com.example.web_project.service.CartService;
import com.example.web_project.service.OrderService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/customer/orders")
@CrossOrigin("*")
@Tag(name = "Khách hàng - Đơn hàng", description = "Dành cho khách hàng quản lý đơn mua")
public class CustomerOrderController {

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired 
    private CartService cartService;

    @Operation(summary = "Lấy giỏ hàng để hiện lên UI")
    @GetMapping("/cart/{userId}")
    public ResponseEntity<?> getMyCart(@PathVariable Integer userId) {
        return ResponseEntity.ok(cartService.getCartByUser(userId));
    }

    @Operation(summary = "Xử lý Thanh toán")
    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(@RequestBody Map<String, Object> request) {
        try {
            Integer userId = (Integer) request.get("userId");
            String paymentMethod = (String) request.get("paymentMethod");
            String address = (String) request.get("address");
            String phone = (String) request.get("phone");

            Order order = orderService.checkoutFromCart(userId, paymentMethod, address, phone);
            return ResponseEntity.ok(order);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @Operation(summary = "Khách hàng nhấn đặt đơn hàng")
    @PostMapping("/place")
    public Order placeOrder(@RequestBody Order order) {
        return orderService.placeOrder(order);
    }

    @Operation(summary = "Khách xem lịch sử đơn hàng của chính mình")
    @GetMapping("/my-history/{userId}")
    public List<Order> getMyHistory(@PathVariable Integer userId) {
        return orderRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);
    }

    @Operation(summary = "Lấy danh sách đơn mua có lọc và tìm kiếm")
    @GetMapping("/my-orders/{userId}")
    public List<Order> getMyOrders(
            @PathVariable Integer userId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return orderService.getMyOrders(userId, status, keyword);
    }

    @Operation(summary = "Hủy đơn hàng")
    @PutMapping("/cancel/{orderId}")
    public ResponseEntity<?> cancelOrder(@PathVariable Integer orderId) {
        try {
            orderService.cancelOrder(orderId);
            return ResponseEntity.ok("Đã hủy đơn hàng thành công và hoàn lại kho.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @Operation(summary = "Mua lại (Thêm tất cả món trong đơn cũ vào giỏ hàng)")
    @PostMapping("/reorder/{orderId}")
    public ResponseEntity<?> reorder(@PathVariable Integer orderId) {
        try {
            orderService.reorder(orderId);
            return ResponseEntity.ok("Đã thêm các sản phẩm vào giỏ hàng. Đang chuyển hướng...");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}