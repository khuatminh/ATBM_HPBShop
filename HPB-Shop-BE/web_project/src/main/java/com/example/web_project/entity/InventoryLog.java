package com.example.web_project.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Table(name = "Inventory_Logs")
@Data
public class InventoryLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "logId")
    private Integer logId;

    // Thiết lập mối quan hệ với bảng Products
    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    // Thiết lập mối quan hệ với bảng Users (Admin thực hiện)
    @ManyToOne
    @JoinColumn(name = "admin_id")
    private User admin;

    @Column(name = "change_amount")
    private Integer changeAmount;

    // Lý do: 'Restock' (Nhập hàng), 'Sale' (Bán hàng), 'Return' (Trả hàng)...
    private String reason;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}