package com.example.web_project.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.web_project.entity.Order;

@Repository
public interface OrderRepository extends JpaRepository<Order, Integer> {
    // Lấy lịch sử đơn hàng của 1 khách hàng (sắp xếp mới nhất lên đầu)
    List<Order> findByUser_UserIdOrderByCreatedAtDesc(Integer userId);
    
    // Lọc đơn hàng theo trạng thái (pending, shipping...) cho trang Admin
    List<Order> findByStatus(String status);

    // Lọc theo trạng thái cho từng Tab (Chờ thanh toán, Đang giao...) cho trang Customer
    List<Order> findByUser_UserIdAndStatusOrderByCreatedAtDesc(Integer userId, String status);

    // Thêm hàm đếm để đổ vào thẻ KPI
    long countByStatus(String status);

    // Lấy 5 đơn hàng mới nhất để hiện ở bảng
    List<Order> findTop5ByOrderByCreatedAtDesc();

    // Thống kê doanh thu theo ngày trong 7 ngày gần nhất
    @Query("SELECT FUNCTION('DATE', o.createdAt), SUM(o.totalPrice) " +
           "FROM Order o WHERE o.createdAt >= :startDate AND o.status = 'completed' " +
           "GROUP BY FUNCTION('DATE', o.createdAt) ORDER BY FUNCTION('DATE', o.createdAt) ASC")
    List<Object[]> getRevenueLast7Days(@Param("startDate") LocalDateTime startDate);

    // Thống kê số lượng bán ra theo thương hiệu (Cho biểu đồ tròn)
    @Query("SELECT p.brand, SUM(oi.quantity) FROM OrderItem oi " +
           "JOIN oi.product p JOIN oi.order o " +
           "WHERE o.status = 'completed' GROUP BY p.brand")
    List<Object[]> getSalesByBrand();

    // Đếm số đơn hàng tạo sau một mốc thời gian (Dùng cho "Đơn hàng mới")
    long countByCreatedAtAfter(LocalDateTime date);

    // Lấy danh sách đơn hoàn thành sau một mốc thời gian (Dùng tính doanh thu tháng)
    List<Order> findByStatusAndCreatedAtAfter(String status, LocalDateTime date);

    // Tìm kiếm theo Mã đơn hoặc Tên sản phẩm
    @Query("SELECT DISTINCT o FROM Order o JOIN o.orderItems oi JOIN oi.product p " +
           "WHERE o.user.userId = :userId AND (CAST(o.orderId AS string) LIKE %:keyword% OR p.name LIKE %:keyword%)")
    List<Order> searchMyOrders(Integer userId, String keyword);
}