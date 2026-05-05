# CHƯƠNG 6: PHÒNG CHỐNG SQL INJECTION — HPB-Shop

> Sau khi chứng minh 5 lỗ hổng hoạt động trong Chương 5, phần này trình bày cách vá từng lỗ hổng cụ thể và các lớp phòng thủ bổ sung theo mô hình Defense in Depth.

---

## Nguyên nhân gốc rễ

Tất cả 5 lỗ hổng đều có cùng một nguyên nhân duy nhất: **ghép chuỗi user input trực tiếp vào câu lệnh SQL**.

```
SQL = "SELECT ... WHERE field='" + USER_INPUT + "'"
                                   ^^^^^^^^^^^
                              Kẻ tấn công kiểm soát được cấu trúc SQL
```

Giải pháp dứt điểm cũng chỉ có một: **Parameterized Query (Prepared Statement)** — tách biệt hoàn toàn code SQL và dữ liệu người dùng. Các biện pháp còn lại là phòng thủ theo chiều sâu, không thể thay thế cho việc viết code đúng.

---

## 6.1 Vá Lỗ hổng 1 — Authentication Bypass

### Vấn đề

`UserService.java` so sánh mật khẩu ngay trong câu SQL và ghép chuỗi trực tiếp:

```java
// VULNERABLE — kẻ tấn công kiểm soát cấu trúc WHERE
String sql = "SELECT * FROM users WHERE username='" + identifier
           + "' AND password='" + password + "'";
```

Ngoài lỗ hổng inject, đoạn code này còn sai về mặt bảo mật mật khẩu: nó so sánh plaintext password với giá trị trong DB — nhưng DB lưu BCrypt hash, nên login thật sự luôn thất bại với code gốc. Kẻ tấn công bypass được chính vì câu SQL bị inject trước khi đến bước so sánh.

### Cách sửa — Dùng JPA + BCrypt

```java
// SAFE — JPA parameterize tự động, BCrypt verify đúng cách
public User login(String identifier, String password) {
    User user = userRepository.findByEmailOrUsername(identifier, identifier)
                              .orElse(null);
    if (user != null && passwordEncoder.matches(password, user.getPassword())) {
        return user;
    }
    return null;
}
```

**Tại sao an toàn:**
- `findByEmailOrUsername()` dùng JPA — Spring tự tạo Prepared Statement với `?` placeholder, `identifier` không bao giờ ảnh hưởng đến cấu trúc SQL.
- `passwordEncoder.matches()` dùng BCrypt — so sánh đúng cách giữa plaintext và hash, không cần đưa mật khẩu vào SQL.

**Kiểm chứng:** sau khi sửa, payload `admin' -- ` hoặc `' OR role='admin' -- ` đều bị từ chối với HTTP 401:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"admin'\'' -- ","password":"x"}'
# Kết quả: 401
```

---

## 6.2 Vá Lỗ hổng 2 — UNION-based SQL Injection

### Vấn đề

`searchProducts()` ghép `keyword` vào mệnh đề `LIKE` không qua escape:

```java
// VULNERABLE
String sql = "... WHERE name LIKE '%" + keyword + "%' OR brand LIKE '%" + keyword + "%'";
return jdbcTemplate.queryForList(sql);
```

### Cách sửa — Dùng JPA hoặc PreparedStatement

**Cách 1 — JPA (đơn giản nhất):**
```java
// SAFE — JPA tự tạo LIKE ? với parameter binding
public List<Product> searchProducts(String keyword) {
    return productRepository
        .findByNameContainingIgnoreCaseOrBrandContainingIgnoreCase(keyword, keyword);
}
```

**Cách 2 — JdbcTemplate với placeholder (nếu cần giữ raw SQL):**
```java
// SAFE — ? placeholder không thể chứa UNION hay cấu trúc SQL
public List<Map<String, Object>> searchProducts(String keyword) {
    String sql = "SELECT product_id AS productId, name, brand, price, "
               + "image_url AS imageUrl, description, stock, sku "
               + "FROM products WHERE name LIKE ? OR brand LIKE ?";
    String param = "%" + keyword + "%";
    return jdbcTemplate.queryForList(sql, param, param);
}
```

**Tại sao an toàn:** giá trị `?` được driver JDBC truyền như một literal string — dù keyword chứa `UNION SELECT` hay `'` thì database xử lý nó như một chuỗi để tìm kiếm, không phải như SQL code.

**Kiểm chứng:** payload UNION trả về đúng 0 sản phẩm (không tìm thấy từ khóa `%' UNION SELECT...`), không leak dữ liệu:

```bash
curl -s "http://localhost:8080/api/products/search?keyword=%25%27%20UNION%20SELECT%20..." \
  | python3 -c "import json,sys; print(len(json.load(sys.stdin)),'kết quả')"
# Kết quả: 0 kết quả
```

---

## 6.3 Vá Lỗ hổng 3 — Error-based SQL Injection

Lỗ hổng này có **hai nguyên nhân** phải vá cùng lúc:

### Nguyên nhân 1 — `@PathVariable String id` không validate kiểu dữ liệu

```java
// VULNERABLE — String nhận bất kỳ chuỗi nào, kể cả payload
public ResponseEntity<?> getProductDetail(@PathVariable String id) {
    List<Map<String, Object>> result = productService.getProductById(id);
    ...
}
```

**Cách sửa — đổi lại thành `Integer`:**

```java
// SAFE — Spring tự từ chối bất kỳ giá trị nào không phải số nguyên
@GetMapping("/{id}")
public ResponseEntity<Product> getProductDetail(@PathVariable Integer id) {
    Product product = productService.getProductById(id);
    if (product == null) return ResponseEntity.notFound().build();
    return ResponseEntity.ok(product);
}
```

Và trong `ProductService.java`:
```java
// SAFE — JPA với Integer
public Product getProductById(Integer id) {
    return productRepository.findById(id).orElse(null);
}
```

Khi `id` là `Integer`, payload `1 AND extractvalue(...)` khiến Spring trả về ngay **HTTP 400 Bad Request** trước khi vào service — không bao giờ chạm đến database.

### Nguyên nhân 2 — Server expose error message

```properties
# VULNERABLE — application.properties
server.error.include-message=always
server.error.include-stacktrace=always
```

**Cách sửa — tắt expose error trong production:**

```properties
# SAFE — application.properties (production)
server.error.include-message=never
server.error.include-stacktrace=never
server.error.include-binding-errors=never
```

Ngay cả nếu vẫn còn lỗ hổng inject, kẻ tấn công cũng không đọc được thông tin từ error message vì server chỉ trả về `"Internal Server Error"` mà không có chi tiết.

**Nguyên tắc:** không bao giờ để lỗi nội bộ (stack trace, SQL error, tên class) xuất hiện trong HTTP response trả về client.

---

## 6.4 Vá Lỗ hổng 4 — Boolean-based Blind SQL Injection

### Vấn đề

`getFilteredProducts()` ghép `brand` trực tiếp vào `WHERE` clause:

```java
// VULNERABLE
if (brand != null && !brand.isBlank()) {
    sql.append(" AND brand='").append(brand).append("'"); // injection point
}
```

### Cách sửa — Dùng PreparedStatement với parameter list

```java
// SAFE — dùng ? và truyền params riêng biệt
public List<Map<String, Object>> getFilteredProducts(
        String brand, BigDecimal minPrice, BigDecimal maxPrice, String sortType) {

    StringBuilder sql = new StringBuilder(
        "SELECT product_id AS productId, name, brand, price, "
      + "image_url AS imageUrl, description, stock, sku FROM products WHERE 1=1");

    List<Object> params = new ArrayList<>();

    if (brand != null && !brand.isBlank()) {
        sql.append(" AND brand=?");      // ← ? placeholder, không ghép chuỗi
        params.add(brand);
    }
    if (minPrice != null) { sql.append(" AND price >= ?"); params.add(minPrice); }
    if (maxPrice != null) { sql.append(" AND price <= ?"); params.add(maxPrice); }

    // Sắp xếp: whitelist thay vì nhận trực tiếp từ user
    if ("priceAsc".equals(sortType))       sql.append(" ORDER BY price ASC");
    else if ("priceDesc".equals(sortType)) sql.append(" ORDER BY price DESC");
    else                                    sql.append(" ORDER BY product_id DESC");

    return jdbcTemplate.queryForList(sql.toString(), params.toArray());
}
```

**Hoặc dùng JPA Specification (sạch hơn):**
```java
// SAFE — JPA Specification tự động parameterize
public List<Product> getFilteredProducts(String brand, BigDecimal min, BigDecimal max, String sort) {
    Specification<Product> spec = Specification.where(null);
    if (brand != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("brand"), brand));
    if (min != null)   spec = spec.and((root, q, cb) -> cb.ge(root.get("price"), min));
    if (max != null)   spec = spec.and((root, q, cb) -> cb.le(root.get("price"), max));
    return productRepository.findAll(spec);
}
```

**Kiểm chứng:** sau khi sửa, cả payload TRUE (`Yonex' AND 1=1-- `) lẫn FALSE (`Yonex' AND 1=2-- `) đều trả về 0 sản phẩm — không có sự khác biệt để khai thác:

```bash
curl "...filter?brand=Yonex%27%20AND%201%3D1--%20"  # → 0 (JPA escape quote)
curl "...filter?brand=Yonex%27%20AND%201%3D2--%20"  # → 0 (JPA escape quote)
# Không còn side channel TRUE/FALSE → Boolean Blind thất bại
```

---

## 6.5 Vá Lỗ hổng 5 — Time-based Blind SQL Injection

### Vấn đề

`getMyOrders()` nhận `userId` là `String` và ghép trực tiếp vào SQL:

```java
// VULNERABLE — String userId nhận mọi payload
public List<Map<String, Object>> getMyOrders(String userId, ...) {
    StringBuilder sql = new StringBuilder(
        "... FROM orders WHERE user_id=").append(userId); // injection point
    ...
}
```

### Cách sửa — Đổi lại `Integer` + JPA

```java
// SAFE — Integer tự validate, JPA tự parameterize
public List<Order> getMyOrders(Integer userId, String status, String keyword) {
    if (keyword != null && !keyword.isEmpty()) {
        return orderRepository.searchMyOrders(userId, keyword);
    }
    if (status != null && !status.equalsIgnoreCase("all")) {
        return orderRepository.findByUser_UserIdAndStatusOrderByCreatedAtDesc(userId, status);
    }
    return orderRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);
}
```

Và trong controller:
```java
// SAFE — @PathVariable Integer tự từ chối "1 AND IF(SLEEP...)"
@GetMapping("/my-orders/{userId}")
public List<Order> getMyOrders(@PathVariable Integer userId, ...) {
    return orderService.getMyOrders(userId, status, keyword);
}
```

**Tại sao an toàn:** `Integer` làm Spring tự validate tại tầng controller — payload `1 AND IF(SUBSTRING(...),SLEEP(3),0)` không phải số nguyên → Spring trả về **HTTP 400** ngay lập tức, không bao giờ vào service, không bao giờ chạm database.

**Kiểm chứng:** SLEEP không bao giờ chạy:

```bash
time curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/1%20AND%20IF(SUBSTRING(...),SLEEP(3),0)"
# Kết quả: real 0m0.05s (HTTP 400, không có delay)
```

---

## 6.6 Các lớp phòng thủ bổ sung (Defense in Depth)

Ngoài việc vá trực tiếp từng lỗ hổng, hệ thống cần thêm nhiều lớp bảo vệ. Nếu một lớp bị qua, còn các lớp khác ngăn chặn:

### Lớp 1 — Validate input tại Controller

Ngay cả khi service dùng Prepared Statement, controller nên validate sớm để từ chối sớm:

```java
// Validate kiểu dữ liệu
@PathVariable Integer id          // Spring tự reject non-integer
@RequestParam @Min(1) Integer page // Bean Validation

// Validate định dạng bằng @Pattern
@RequestParam @Pattern(regexp = "^[A-Za-z]+$") String brand

// Validate độ dài
@RequestParam @Size(max = 100) String keyword
```

### Lớp 2 — Cấu hình Error Handling trong production

```properties
# application-production.properties
server.error.include-message=never
server.error.include-stacktrace=never
server.error.include-binding-errors=never
```

Quy tắc: lỗi nội bộ log ra server log (để dev debug), nhưng **không bao giờ** trả về client. Client chỉ nhận mã lỗi HTTP + message chung chung.

### Lớp 3 — Principle of Least Privilege cho Database User

Thay vì dùng `root` hoặc user có toàn quyền, tạo user DB riêng cho ứng dụng với quyền tối thiểu:

```sql
-- Tạo user chỉ có quyền cần thiết
CREATE USER 'hpb_app'@'localhost' IDENTIFIED BY 'strong_password';

-- Chỉ cấp SELECT, INSERT, UPDATE, DELETE — không có DROP, CREATE, GRANT
GRANT SELECT, INSERT, UPDATE, DELETE ON HPBSports_DB.* TO 'hpb_app'@'localhost';

-- Không cấp quyền đọc information_schema (ngăn kẻ tấn công liệt kê cấu trúc DB)
REVOKE SELECT ON information_schema.* FROM 'hpb_app'@'localhost';

FLUSH PRIVILEGES;
```

**Tác dụng:** ngay cả khi lỗ hổng SQLi tồn tại, kẻ tấn công cũng không thể `DROP TABLE`, không thể đọc `information_schema` để liệt kê bảng, không thể tạo user mới.

### Lớp 4 — Web Application Firewall (WAF)

WAF kiểm tra HTTP request trước khi vào ứng dụng và chặn các pattern SQLi phổ biến:

```
Các pattern WAF phát hiện:
  ' OR '1'='1          ← Auth bypass
  UNION SELECT          ← UNION-based
  extractvalue(         ← Error-based
  SLEEP(               ← Time-based
  information_schema    ← Schema enumeration
  --  hoặc  #           ← Comment injection
```

Các WAF phổ biến: **ModSecurity** (open source), **AWS WAF**, **Cloudflare WAF**. WAF không thể thay thế code đúng, nhưng là lớp phòng thủ cuối cùng bắt các payload mà developer chưa nghĩ đến.

### Lớp 5 — Monitoring và Alerting

Ghi log và cảnh báo khi phát hiện pattern bất thường:

```java
// Ví dụ: Spring AOP interceptor kiểm tra input
@Aspect
@Component
public class SqlInjectionMonitor {

    private static final Pattern SQLI_PATTERN = Pattern.compile(
        "(?i)(union|select|insert|drop|delete|--|#|sleep|extractvalue|benchmark)",
        Pattern.CASE_INSENSITIVE
    );

    @Before("@annotation(org.springframework.web.bind.annotation.GetMapping)")
    public void checkRequest(JoinPoint jp) {
        for (Object arg : jp.getArgs()) {
            if (arg instanceof String s && SQLI_PATTERN.matcher(s).find()) {
                log.warn("[SECURITY] Possible SQLi attempt: {}", s);
                // Gửi alert qua email/Slack
            }
        }
    }
}
```

---

## 6.7 So sánh trước và sau khi vá

| Lỗ hổng | Endpoint | Trước (dễ bị tấn công) | Sau (đã vá) |
|---------|---------|----------------------|-------------|
| Auth Bypass | `/api/auth/login` | Raw SQL + so sánh plaintext | JPA + BCrypt `matches()` |
| UNION-based | `/api/products/search` | `LIKE '%" + keyword + "%'` | JPA `Containing` hoặc `LIKE ?` |
| Error-based | `/api/products/{id}` | `String id` + expose error | `Integer id` + `server.error.include-message=never` |
| Boolean Blind | `/api/products/filter` | `brand='").append(brand)` | `brand=?` + params list |
| Time-based Blind | `/api/customer/orders/...` | `String userId` + raw SQL | `Integer userId` + JPA |

---

## 6.8 Kiểm chứng sau khi vá — Verify trên branch `main` (bản đã fix)

Sau khi áp dụng tất cả biện pháp trên, toàn bộ payload từ Chương 5 phải thất bại:

```bash
# 1. Auth Bypass → 401
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"admin'\'' -- ","password":"x"}'
# Expected: 401

# 2. UNION-based → 0 sản phẩm, không leak user
curl -s "http://localhost:8080/api/products/search?keyword=%25%27%20UNION%20SELECT..." \
  | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"
# Expected: 0

# 3. Error-based → 400 (Integer reject payload)
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8080/api/products/1%20AND%20extractvalue(...)"
# Expected: 400

# 4. Boolean Blind → 0 cả TRUE lẫn FALSE (không có side channel)
curl -s "...filter?brand=Yonex%27%20AND%201%3D1--%20" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"
curl -s "...filter?brand=Yonex%27%20AND%201%3D2--%20" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"
# Expected: 0 và 0 (không phân biệt được)

# 5. Time-based → 400, không có delay
time curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/1%20AND%20IF(SLEEP(3),1,0)"
# Expected: HTTP 400, real time < 0.1s
```

---

## Kết luận

Bài học từ 5 lỗ hổng của HPB-Shop:

**Một nguyên nhân → Năm cách khai thác khác nhau.** Dù kẻ tấn công dùng UNION, ERROR, BOOLEAN hay TIME — tất cả đều xuất phát từ cùng một điểm yếu: ghép chuỗi vào SQL.

**Một giải pháp dứt điểm:** không bao giờ ghép chuỗi — luôn dùng Parameterized Query. Trong Spring Boot, đây đồng nghĩa với việc dùng JPA Repository hoặc `JdbcTemplate` với `?` placeholder.

**Defense in Depth:** Prepared Statement là nền tảng không thể thiếu. Bên trên đó, validate kiểu dữ liệu tại controller, tắt error message trong production, cấu hình least privilege cho DB user, và giám sát bất thường — mỗi lớp bắt những gì lớp trước bỏ sót.
