package com.example.web_project.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.web_project.entity.CartItem;
import com.example.web_project.entity.Product;
import com.example.web_project.entity.User;
import com.example.web_project.repository.CartRepository;

@Service
public class CartService {
    @Autowired private CartRepository cartRepository;

    private void validateStock(Product product, Integer requestedQuantity) {
        Integer stockValue = product == null ? null : product.getStock();
        Integer stock = stockValue == null ? 0 : stockValue;
        if (stock <= 0) {
            throw new IllegalArgumentException("Sản phẩm đã hết hàng");
        }
        if (requestedQuantity > stock) {
            throw new IllegalArgumentException("Số lượng vượt quá tồn kho. Chỉ còn " + stock + " sản phẩm");
        }
    }

    public CartItem addToCart(User user, Product product, Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("Số lượng phải lớn hơn 0");
        }

        // Kiểm tra xem trong giỏ đã có cây vợt này chưa
        Optional<CartItem> existingItem = cartRepository.findByUser_UserIdAndProduct_ProductId(user.getUserId(), product.getProductId());
        
        if (existingItem.isPresent()) {
            CartItem item = existingItem.get();
            int newQuantity = item.getQuantity() + quantity;
            validateStock(product, newQuantity);
            item.setQuantity(newQuantity);
            return cartRepository.save(item);
        } else {
            validateStock(product, quantity);
            CartItem newItem = new CartItem();
            newItem.setUser(user);
            newItem.setProduct(product);
            newItem.setQuantity(quantity);
            return cartRepository.save(newItem);
        }
    }

    public List<CartItem> getCartByUser(Integer userId) {
        return cartRepository.findByUser_UserId(userId);
    }

    public void removeFromCart(Integer cartItemId) {
        cartRepository.deleteById(cartItemId);
    }

    public void updateQuantity(Integer cartItemId, Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("Số lượng phải lớn hơn 0");
        }

        CartItem item = cartRepository.findById(cartItemId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm trong giỏ hàng"));

        validateStock(item.getProduct(), quantity);
        item.setQuantity(quantity);
        cartRepository.save(item);
    }
}