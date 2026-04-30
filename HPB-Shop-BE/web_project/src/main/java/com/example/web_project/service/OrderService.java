package com.example.web_project.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.web_project.entity.CartItem;
import com.example.web_project.entity.Order;
import com.example.web_project.entity.OrderItem;
import com.example.web_project.entity.Product;
import com.example.web_project.repository.CartRepository;
import com.example.web_project.repository.OrderRepository;
import com.example.web_project.repository.ProductRepository;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ProductRepository productRepository;
    
    @Autowired 
    private CartRepository cartRepository;

    @Autowired
    private CartService cartService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private int safeStock(Product product) {
        Integer stockValue = product == null ? null : product.getStock();
        Integer stock = stockValue == null ? 0 : stockValue;
        return stock;
    }

    private void ensureInStock(Product product, int quantity) {
        int stock = safeStock(product);
        String productName = product != null && product.getName() != null ? product.getName() : "Sản phẩm";
        if (stock <= 0) {
            throw new RuntimeException("Sản phẩm " + productName + " đã hết hàng");
        }
        if (quantity > stock) {
            throw new RuntimeException("Sản phẩm " + productName + " chỉ còn " + stock + " sản phẩm");
        }
    }

    @Transactional
    public Order placeOrder(Order order) {
        // Kiểm tra tồn kho trước khi lưu đơn
        for (OrderItem item : order.getOrderItems()) {
            var product = item.getProduct();
            ensureInStock(product, item.getQuantity());
        }

        Order savedOrder = orderRepository.save(order);

        //Duyệt qua từng món hàng trong đơn để trừ kho
        for (OrderItem item : order.getOrderItems()) {
            var product = item.getProduct();
            // Cập nhật số lượng tồn kho mới
            product.setStock(product.getStock() - item.getQuantity());
            productRepository.save(product);
        }

        return savedOrder;
    }

    // Lấy tất cả đơn hàng (Admin xem)
    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }

    // Lọc đơn theo trạng thái
    public List<Order> getOrdersByStatus(String status) {
        return orderRepository.findByStatus(status);
    }

    // Cập nhật trạng thái và xử lý hoàn kho nếu hủy đơn
    @Transactional
    public Order updateStatus(Integer id, String newStatus) {
        Order order = orderRepository.findById(id).orElseThrow();
        String oldStatus = order.getStatus();

        // Nếu đơn hàng bị hủy mà trước đó chưa hủy, hoàn lại kho
        if (newStatus.equalsIgnoreCase("cancelled") && !oldStatus.equalsIgnoreCase("cancelled")) {
            for (OrderItem item : order.getOrderItems()) {
                Product product = item.getProduct();
                product.setStock(product.getStock() + item.getQuantity());
                productRepository.save(product);
            }
        }
        
        order.setStatus(newStatus);
        return orderRepository.save(order);
    }

    // 4. Lấy thống kê đơn hàng cho Dashboard
    public Map<String, Object> getOrderStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalOrders", orderRepository.count());
        stats.put("pendingOrders", orderRepository.countByStatus("pending"));
        // Tính tổng doanh thu từ các đơn hàng đã hoàn thành
        BigDecimal revenue = orderRepository.findByStatus("completed").stream()
                .map(Order::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        stats.put("revenue", revenue);
        return stats;
    }

    @Transactional
    public Order checkoutFromCart(Integer userId, String paymentMethod, String address, String phone) {
        // Lấy danh sách hàng trong giỏ
        List<CartItem> cartItems = cartRepository.findByUser_UserId(userId);
        if (cartItems.isEmpty()) throw new RuntimeException("Giỏ hàng trống!");

        // Tạo đơn hàng mới
        Order order = new Order();
        order.setUser(cartItems.get(0).getUser());
        order.setPaymentMethod(paymentMethod);
        order.setShippingAddress(address);
        order.setPhone(phone);
        order.setShippingFee(new BigDecimal(50000));
        order.setStatus("pending");

        BigDecimal subtotal = BigDecimal.ZERO;
        List<OrderItem> orderItems = new ArrayList<>();

        // Chuyển từ CartItem sang OrderItem
        for (CartItem cartItem : cartItems) {
            Product product = cartItem.getProduct();
            
            // Kiểm tra kho trước khi trừ
            ensureInStock(product, cartItem.getQuantity());

            // Trừ kho
            product.setStock(product.getStock() - cartItem.getQuantity());
            productRepository.save(product);

            // Tạo chi tiết đơn hàng
            OrderItem orderItem = new OrderItem();
            orderItem.setOrder(order);
            orderItem.setProduct(product);
            orderItem.setQuantity(cartItem.getQuantity());
            orderItem.setPriceAtPurchase(product.getPrice()); // Lưu giá tại thời điểm mua
            
            orderItems.add(orderItem);
            subtotal = subtotal.add(product.getPrice().multiply(new BigDecimal(cartItem.getQuantity())));
        }

        order.setTotalPrice(subtotal.add(order.getShippingFee()));
        order.setOrderItems(orderItems);

        // Lưu đơn hàng và Xóa giỏ hàng sau khi mua xong
        Order savedOrder = orderRepository.save(order);
        cartRepository.deleteByUser_UserId(userId);

        return savedOrder;
    }

    // [VULN] Time-based Blind SQLi — raw SQL với userId nối chuỗi vào WHERE
    public List<Map<String, Object>> getMyOrders(String userId, String status, String keyword) {
        StringBuilder sql = new StringBuilder(
            "SELECT order_id AS orderId, user_id AS userId, total_price AS totalPrice, "
          + "status, shipping_address AS shippingAddress, phone, payment_method AS paymentMethod, "
          + "shipping_fee AS shippingFee, created_at AS createdAt "
          + "FROM orders WHERE user_id=").append(userId); // ← injection point
        if (status != null && !status.equalsIgnoreCase("all") && !status.isBlank()) {
            sql.append(" AND status='").append(status).append("'");
        }
        sql.append(" ORDER BY created_at DESC");
        return jdbcTemplate.queryForList(sql.toString());
    }

    // Logic Hủy đơn hàng
    @Transactional
    public void cancelOrder(Integer orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng"));

        // Chỉ cho phép hủy khi đơn ở trạng thái 'pending'
        if (!order.getStatus().equalsIgnoreCase("pending")) {
            throw new RuntimeException("Chỉ có thể hủy đơn hàng đang chờ xác nhận!");
        }

        // Hoàn lại số lượng vào kho
        for (OrderItem item : order.getOrderItems()) {
            Product product = item.getProduct();
            product.setStock(product.getStock() + item.getQuantity());
            productRepository.save(product);
        }

        // Cập nhật trạng thái thành 'cancelled'
        order.setStatus("cancelled");
        orderRepository.save(order);
    }

    @Transactional
    public void reorder(Integer orderId) {
        // Tìm lại đơn hàng cũ
        Order oldOrder = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng cũ"));

        // Duyệt qua từng món trong đơn cũ
        for (OrderItem item : oldOrder.getOrderItems()) {
            // Bỏ ngược vào giỏ hàng của User đó
            cartService.addToCart(oldOrder.getUser(), item.getProduct(), item.getQuantity());
        }
    }
}