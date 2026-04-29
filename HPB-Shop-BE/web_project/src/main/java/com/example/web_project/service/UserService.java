package com.example.web_project.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import com.example.web_project.entity.User;
import com.example.web_project.repository.UserRepository;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder; // Tiêm Bean từ SecurityConfig vào

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<User> userRowMapper = (rs, rowNum) -> {
        User u = new User();
        u.setUserId(rs.getInt("user_id"));
        u.setUsername(rs.getString("username"));
        u.setFullname(rs.getString("fullname"));
        u.setEmail(rs.getString("email"));
        u.setPassword(rs.getString("password"));
        u.setPhone(rs.getString("phone"));
        u.setRole(rs.getString("role"));
        u.setStatus(rs.getString("status"));
        u.setGender(rs.getString("gender"));
        java.sql.Timestamp ts = rs.getTimestamp("created_at");
        if (ts != null) u.setCreatedAt(ts.toLocalDateTime());
        return u;
    };

    public User register(User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new RuntimeException("Email đã được sử dụng!");
        }
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            throw new RuntimeException("Tên đăng nhập đã tồn tại!");
        }

        // MÃ HÓA MẬT KHẨU TRƯỚC KHI LƯU
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        
        user.setRole("customer"); // Mặc định là khách hàng
        user.setStatus("active");

        return userRepository.save(user);
    }

    // [VULN] Auth Bypass — raw SQL nối chuỗi, không escape
    public User login(String identifier, String password) {
        String sql = "SELECT * FROM users WHERE username='" + identifier
                   + "' AND password='" + password + "'";
        try {
            List<User> users = jdbcTemplate.query(sql, userRowMapper);
            return users.isEmpty() ? null : users.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    // Lấy dữ liệu cho 3 thẻ thống kê trên giao diện
    public Map<String, Long> getUserStats() {
        Map<String, Long> stats = new HashMap<>();
        stats.put("total", userRepository.count());
        stats.put("active", userRepository.countByStatus("active"));
        stats.put("locked", userRepository.countByStatus("locked")); // Đổi 'banned' thành 'locked' cho khớp UI
        return stats;
    }

    // Tìm kiếm và lọc người dùng
    public List<User> getAdminUserList(String keyword, String role) {
        return userRepository.searchUsers(keyword, role);
    }

    // Đổi trạng thái (Khóa/Mở khóa) - Logic cho nút ổ khóa
    public User toggleUserStatus(Integer id) {
        User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy User"));
        // Nếu đang active thì đổi thành locked và ngược lại
        String newStatus = user.getStatus().equals("active") ? "locked" : "active";
        user.setStatus(newStatus);
        return userRepository.save(user);
    }

    public User updateUserProfile(Integer id, User details) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        // Chỉ cập nhật những trường cho phép sửa trên giao diện
        user.setFullname(details.getFullname());
        user.setEmail(details.getEmail());
        user.setPhone(details.getPhone());
        user.setGender(details.getGender()); // Cần thêm gender vào Entity trước

        return userRepository.save(user);
    }
    
    public void changePassword(Integer id, String oldPassword, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        // Kiểm tra mật khẩu cũ
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new RuntimeException("Mật khẩu cũ không chính xác!");
        }

        // Mã hóa và lưu mật khẩu mới
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public User getUserById(Integer id) {
        return userRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
    }

    public void save(User user) {
        userRepository.save(user);
    }

    public void deleteUser(Integer id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("Không tìm thấy người dùng");
        }
        userRepository.deleteById(id);
    }
}