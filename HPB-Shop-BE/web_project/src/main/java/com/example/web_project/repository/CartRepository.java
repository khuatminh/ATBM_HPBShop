package com.example.web_project.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.web_project.entity.CartItem;

public interface CartRepository extends JpaRepository<CartItem, Integer> {
    List<CartItem> findByUser_UserId(Integer userId);
    Optional<CartItem> findByUser_UserIdAndProduct_ProductId(Integer userId, Integer productId);
    void deleteByUser_UserId(Integer userId); // Xóa giỏ sau khi thanh toán xong
}