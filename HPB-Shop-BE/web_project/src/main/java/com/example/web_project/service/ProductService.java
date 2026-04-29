package com.example.web_project.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import com.example.web_project.entity.Product;
import com.example.web_project.repository.ProductRepository;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

    // Lấy tất cả sản phẩm
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    // Lấy chi tiết 1 sản phẩm theo ID
    public Product getProductById(Integer id) {
        return productRepository.findById(id).orElse(null);
    }

    public List<Product> searchProducts(String keyword) {
        return productRepository.findByNameContainingIgnoreCaseOrBrandContainingIgnoreCase(keyword, keyword);
    }

    // Lọc sản phẩm theo hãng (Yonex, Lining...)
    public List<Product> getProductsByBrand(String brand) {
        return productRepository.findByBrand(brand);
    }

    public Product saveProduct(Product product) {
        return productRepository.save(product);
    }

    public void deleteProduct(Integer id) {
        productRepository.deleteById(id);
    }

    public List<Product> getFilteredProducts(String brand, BigDecimal minPrice, BigDecimal maxPrice, String sortType) {
        Sort sort = Sort.by("productId").descending(); // Mặc định mới nhất lên đầu

        if ("priceAsc".equals(sortType)) {
            sort = Sort.by("price").ascending();
        } else if ("priceDesc".equals(sortType)) {
            sort = Sort.by("price").descending();
        }

        return productRepository.filterProducts(brand, minPrice, maxPrice, sort);
    }

    public List<Product> getTopHotProducts(int limit) {
        int safeLimit = Math.max(1, limit);
        List<Object[]> rows = productRepository.findTopSellingProducts(PageRequest.of(0, safeLimit));

        List<Product> products = new ArrayList<>();
        for (Object[] row : rows) {
            if (row != null && row.length > 0 && row[0] instanceof Product product) {
                products.add(product);
            }
        }

        if (!products.isEmpty()) {
            return products;
        }

        return productRepository.findAll(Sort.by("createdAt").descending())
                .stream()
                .limit(safeLimit)
                .toList();
    }
}