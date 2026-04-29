package com.example.web_project.controller.customer;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.web_project.entity.Product;
import com.example.web_project.entity.User;
import com.example.web_project.service.CartService;
import com.example.web_project.service.ProductService;
import com.example.web_project.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController("customerCartController")
@RequestMapping("/api/customer/cart")
@CrossOrigin("*")
@Tag(name = "Khách hàng - Giỏ hàng")
public class CartController {
    
    @Autowired private CartService cartService;
    @Autowired private UserService userService;
    @Autowired private ProductService productService;

    @Operation(summary = "Thêm một món hàng vào giỏ")
    @PostMapping("/add")
    public ResponseEntity<?> addToCart(@RequestBody Map<String, Integer> request) {
        Integer userId = request.get("userId");
        Integer productId = request.get("productId");
        Integer quantity = request.get("quantity");

        User user = userService.getUserById(userId);
        Product product = productService.getProductById(productId);

        return ResponseEntity.ok(cartService.addToCart(user, product, quantity));
    }

    @Operation(summary = "Xóa một món hàng khỏi giỏ")
    @DeleteMapping("/{cartItemId}")
    public ResponseEntity<?> remove(@PathVariable Integer cartItemId) {
        cartService.removeFromCart(cartItemId);
        return ResponseEntity.ok("Đã xóa khỏi giỏ hàng");
    }

    @Operation(summary = "Cập nhật số lượng trong giỏ")
    @PutMapping("/{cartItemId}")
    public ResponseEntity<?> updateQuantity(@PathVariable Integer cartItemId, @RequestParam Integer quantity) {
        cartService.updateQuantity(cartItemId, quantity);
        return ResponseEntity.ok("Đã cập nhật số lượng trong giỏ hàng");
    }
}
