package com.example.web_project.controller.admin;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.entity.User;
import com.example.web_project.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Admin - Người dùng", description = "Quản lý thành viên hệ thống")
@RestController
@RequestMapping("/api/admin/users")
@CrossOrigin("*")
public class UserController {

    @Autowired
    private UserService userService;

    // API cho 3 thẻ KPI trên cùng
    @Operation(summary = "Lấy số liệu 3 thẻ thống kê Dashboard")
    @GetMapping("/stats")
    public Map<String, Long> getStats() {
        return userService.getUserStats();
    }

    // API lấy danh sách kèm tìm kiếm và lọc vai trò
    @Operation(summary = "Lấy danh sách người dùng")
    @GetMapping
    public List<User> getUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "all") String role) {
        return userService.getAdminUserList(keyword, role);
    }

    @Operation(summary = "Khóa/Mở khóa tài khoản")
    @PatchMapping("/{id}/toggle-status")
    public User toggleStatus(@PathVariable Integer id) {
        return userService.toggleUserStatus(id);
    }

    @Operation(summary = "Xóa người dùng")
    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Integer id) {
        // userService.delete(id);
    }
}