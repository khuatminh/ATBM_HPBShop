package com.example.web_project.controller.admin;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.entity.Product;
import com.example.web_project.service.ProductService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/admin/products")
@CrossOrigin("*") 
@Tag(name = "Admin - Sản phẩm", description = "Quản lý kho vợt cầu lông")
public class ProductController {

    @Autowired
    private ProductService productService;

    // Lấy toàn bộ sản phẩm
    @Operation(summary = "Lấy danh sách tất cả sản phẩm")
    @GetMapping
    public List<Product> getAllProducts() {
        return productService.getAllProducts();
    }

    // Lấy theo hãng
    @Operation(summary = "Lọc sản phẩm theo hãng")
    @GetMapping("/brand/{brand}")
    public List<Product> getProductsByBrand(@PathVariable String brand) {
        return productService.getProductsByBrand(brand);
    }

    // Lấy chi tiết 1 sản phẩm
    @Operation(summary = "Lấy thông tin chi tiết 1 sản phẩm")
    @GetMapping("/{id}")
    public Product getProductById(@PathVariable Integer id) {
        return productService.getProductById(id);
    }

    // Thêm mới sản phẩm
    @Operation(summary = "Thêm mới sản phẩm")
    @PostMapping
    public Product addProduct(@RequestBody Product product) {
        return productService.saveProduct(product);
    }

    @Operation(summary = "Cập nhật thông tin sản phẩm")
    @PutMapping("/{id}")
    public Product update(@PathVariable Integer id, @RequestBody Product product) {
        product.setProductId(id); 
        return productService.saveProduct(product);
    }

    @Operation(summary = "Xóa sản phẩm")
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Integer id) {
        productService.deleteProduct(id);
    }
}