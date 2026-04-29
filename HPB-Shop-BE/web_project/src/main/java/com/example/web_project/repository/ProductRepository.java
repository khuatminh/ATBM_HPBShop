package com.example.web_project.repository;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.web_project.entity.Product;

@Repository
public interface ProductRepository extends JpaRepository<Product, Integer> {

    @Query("SELECT p FROM Product p WHERE " +
           "(:brand IS NULL OR p.brand = :brand) AND " +
           "(:minPrice IS NULL OR p.price >= :minPrice) AND " +
           "(:maxPrice IS NULL OR p.price <= :maxPrice)")
    List<Product> filterProducts(
            @Param("brand") String brand, 
            @Param("minPrice") BigDecimal minPrice, 
            @Param("maxPrice") BigDecimal maxPrice, 
            Sort sort);
    // Tìm kiếm vợt theo hãng (Yonex, Lining, Victor...)
    List<Product> findByBrand(String brand);
    
    // Tìm kiếm sản phẩm theo tên (Dùng cho thanh tìm kiếm)
    List<Product> findByNameContainingIgnoreCase(String name);
    
    // Tìm sản phẩm còn hàng (Quantity > 0)
    List<Product> findByStockGreaterThan(Integer stock);

    List<Product> findByNameContainingIgnoreCaseOrBrandContainingIgnoreCase(String name, String brand);
    
    List<Product> findByStockLessThan(Integer stock);

    @Query("SELECT oi.product, SUM(oi.quantity) " +
           "FROM OrderItem oi " +
           "WHERE LOWER(COALESCE(oi.order.status, '')) <> 'cancelled' " +
           "GROUP BY oi.product " +
           "ORDER BY SUM(oi.quantity) DESC")
    List<Object[]> findTopSellingProducts(Pageable pageable);
}