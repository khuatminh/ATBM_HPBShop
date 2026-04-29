package com.example.web_project.controller;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.entity.Product;
import com.example.web_project.service.ProductService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/products")
@CrossOrigin("*")
@Tag(name = "Trang chủ - Sản phẩm", description = "API công khai cho khách xem và lọc vợt")
public class PublicProductController {

    @Autowired
    private ProductService productService;

    @Operation(summary = "Tìm kiếm vợt theo tên hoặc hãng")
    @GetMapping("/search")
    public List<Product> search(@RequestParam String keyword) {
        return productService.searchProducts(keyword);
    }

    @Operation(summary = "Lấy tất cả vợt để hiện lên trang chủ")
    @GetMapping
    public List<Product> getAll() {
        return productService.getAllProducts(); 
    }

    @Operation(summary = "Lọc vợt theo tab (Yonex, Lining, Victor...)")
    @GetMapping("/brand/{brand}")
    public List<Product> getByBrand(@PathVariable String brand) {
        return productService.getProductsByBrand(brand); 
    }

    @Operation(summary = "Lấy danh sách sản phẩm hot (bán chạy)")
    @GetMapping("/hot")
    public List<Product> getHotProducts(@RequestParam(defaultValue = "3") int limit) {
        return productService.getTopHotProducts(limit);
    }

    @Operation(summary = "Lấy chi tiết sản phẩm theo ID")
    @GetMapping("/{id}")
    public ResponseEntity<Product> getProductDetail(@PathVariable Integer id) {
        Product product = productService.getProductById(id);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(product);
    }

    @Operation(summary = "Lọc sản phẩm nâng cao (Hãng, Giá, Sắp xếp)")
    @GetMapping("/filter")
    public ResponseEntity<List<Product>> filterProducts(
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "default") String sort) {
        
        List<Product> results = productService.getFilteredProducts(brand, minPrice, maxPrice, sort);
        return ResponseEntity.ok(results);
    }
}