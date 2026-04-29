package com.example.web_project.controller.customer;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.entity.User;
import com.example.web_project.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/customer/profile")
@CrossOrigin("*")
@Tag(name = "Khách hàng - Hồ sơ", description = "Quản lý thông tin cá nhân và mật khẩu")
public class CustomerUserController {
    @Autowired
    private UserService userService;

    @Operation(summary = "Lấy thông tin hiện tại của khách hàng")
    @GetMapping("/{id}")
    public ResponseEntity<User> getMyProfile(@PathVariable Integer id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @Operation(summary = "Cập nhật thông tin (Tên, Email, SĐT, Giới tính)")
    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateMyProfile(@PathVariable Integer id, @RequestBody User userDetails) {
        try {
            User updated = userService.updateUserProfile(id, userDetails);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Không thể cập nhật hồ sơ lúc này. Vui lòng thử lại.");
        }
    }

    @Operation(summary = "Đổi mật khẩu")
    @PutMapping("/change-password/{id}")
    public ResponseEntity<?> updatePassword(@PathVariable Integer id, @RequestBody Map<String, String> request) {
        try {
            userService.changePassword(id, request.get("oldPassword"), request.get("newPassword"));
            return ResponseEntity.ok("Đổi mật khẩu thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Không thể đổi mật khẩu lúc này. Vui lòng thử lại.");
        }
    }
}