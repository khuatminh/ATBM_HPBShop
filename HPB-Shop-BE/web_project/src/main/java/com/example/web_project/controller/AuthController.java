package com.example.web_project.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping; 
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.config.JwtTokenProvider;
import com.example.web_project.entity.User;
import com.example.web_project.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Xác thực", description = "Đăng ký và đăng nhập người dùng")
@RestController
@RequestMapping("/api/auth")
@CrossOrigin("*")
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    // API Đăng ký
    @Operation(summary = "Đăng ký tài khoản mới")
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        try {
            User newUser = userService.register(user);
            return ResponseEntity.ok(newUser);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // API Đăng nhập 
    @Operation(summary = "Đăng nhập với email hoặc username")
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String identifier = credentials.get("loginId");
        String password = credentials.get("password");

        User user = userService.login(identifier, password);
        
        if (user != null) {
            if (user.getStatus().equals("locked")) {
                return ResponseEntity.status(403).body("Tài khoản của bro đã bị khóa!");
            }
            
            String token = tokenProvider.generateToken(user.getUsername(), user.getRole());
            
            Map<String, Object> result = new HashMap<>();
            result.put("user", user);
            result.put("token", token);
            
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.status(401).body("Sai tài khoản hoặc mật khẩu!");
    }
}