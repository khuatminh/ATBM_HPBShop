package com.example.web_project.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.web_project.entity.User;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    
    Optional<User> findByEmail(String email);
    
    Optional<User> findByUsername(String username);
    
    Optional<User> findByEmailOrUsername(String identifier1, String identifier2);    List<User> findByRole(String role);
    // Đếm số lượng theo trạng thái để đổ vào 3 thẻ KPI
    long countByStatus(String status);

    // Tìm kiếm tổng hợp: Tên, Email hoặc SĐT + Lọc theo Role
    @Query("SELECT u FROM User u WHERE " +
           "(:role = 'all' OR u.role = :role) AND " +
           "(:kw IS NULL OR u.fullname LIKE %:kw% OR u.email LIKE %:kw% OR u.phone LIKE %:kw%)")
    List<User> searchUsers(@Param("kw") String keyword, @Param("role") String role);
}