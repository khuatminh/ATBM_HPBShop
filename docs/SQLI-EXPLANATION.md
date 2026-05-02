# Phân tích 5 Lỗ hổng SQL Injection — HPB-Shop Demo

> BTL Môn Nhập môn An toàn Bảo mật Hệ thống Thông tin
> CEH Module 15: SQL Injection

---

## Tổng quan: Tại sao SQLi xảy ra?

SQL Injection xảy ra khi ứng dụng **ghép chuỗi trực tiếp từ user input vào câu lệnh SQL** thay vì dùng Parameterized Query (Prepared Statement). Kẻ tấn công lợi dụng điều này để thay đổi cấu trúc logic của SQL, khiến database thực thi những lệnh ngoài ý muốn của lập trình viên.

**Công thức chung:**
```
SQL = "SELECT ... WHERE field='" + USER_INPUT + "'"
                                   ^^^^^^^^^^^^
                              ← Nếu input chứa ' thì cấu trúc SQL bị phá vỡ
```

---

## Lỗ hổng 1 — Authentication Bypass (Auth Bypass)

### Cơ chế hoạt động

**Endpoint:** `POST /api/auth/login`

**Code dễ bị tấn công (`UserService.java`):**
```java
String sql = "SELECT * FROM users WHERE username='" + identifier
           + "' AND password='" + password + "'";
```

**Với input bình thường** (`admin` / `admin123`), SQL sinh ra:
```sql
SELECT * FROM users WHERE username='admin' AND password='admin123'
```
→ Chỉ trả về user nếu cả username VÀ password đúng.

**Với payload tấn công** (`admin' -- ` / `bất kỳ`), SQL sinh ra:
```sql
SELECT * FROM users WHERE username='admin' -- ' AND password='anything'
```
→ Phần `AND password=...` bị comment out bởi `-- `, chỉ cần username đúng là đăng nhập được.

**Payload OR** (`' OR role='admin' -- ` / `x`):
```sql
SELECT * FROM users WHERE username='' OR role='admin' -- ' AND password='x'
```
→ Điều kiện `OR role='admin'` luôn đúng, trả về user admin đầu tiên trong DB.

### Nguyên nhân

- Ghép chuỗi trực tiếp: `"...WHERE username='" + identifier + "'"` — kẻ tấn công điều khiển được cấu trúc SQL.
- Không kiểm tra/escape ký tự đặc biệt (`'`, `--`, `OR`).
- Không dùng BCrypt matching trong tầng SQL (so sánh plaintext với hash trong DB).

### Giải pháp

Dùng **Parameterized Query** (JPA / PreparedStatement):
```java
// SAFE — JPA tự escape mọi input
User user = userRepository.findByUsername(identifier);
if (user != null && passwordEncoder.matches(password, user.getPassword())) {
    return user;
}
return null;
```
JPA compile SQL thành `WHERE username = ?` — dấu `?` là placeholder, value được truyền riêng biệt, không thể phá vỡ cấu trúc SQL.

---

## Lỗ hổng 2 — UNION-based SQLi

### Cơ chế hoạt động

**Endpoint:** `GET /api/products/search?keyword=`

**Code dễ bị tấn công (`ProductService.java`):**
```java
String sql = "SELECT product_id AS productId, name, brand, price, "
           + "image_url AS imageUrl, description, stock, sku "
           + "FROM products WHERE name LIKE '%" + keyword + "%' OR brand LIKE '%" + keyword + "%'";
```

**Với input bình thường** (`Yonex`), SQL sinh ra:
```sql
SELECT product_id, name, brand, price, image_url, description, stock, sku
FROM products WHERE name LIKE '%Yonex%' OR brand LIKE '%Yonex%'
```

**Với payload UNION:**
```
%' UNION SELECT user_id, username, email, 0, password, role, 0, 'hack' FROM users-- 
```
SQL sinh ra:
```sql
SELECT product_id, name, brand, price, image_url, description, stock, sku
FROM products WHERE name LIKE '%%'          ← khớp tất cả sản phẩm
UNION
SELECT user_id, username, email, 0, password, role, 0, 'hack' FROM users-- 
```
→ Toán tử `UNION` ghép kết quả của 2 SELECT. Kết quả trả về gồm cả 12 sản phẩm lẫn toàn bộ user trong DB.

**Điều kiện để UNION hoạt động:**
1. Số cột phải bằng nhau (8 = 8).
2. Kiểu dữ liệu các cột phải tương thích (dùng `0` cho cột số, string cho cột text).

### Nguyên nhân

- Ghép `keyword` vào mệnh đề `LIKE` không qua escape.
- API trả về toàn bộ kết quả dưới dạng JSON, bao gồm cả dữ liệu bị inject.
- `JdbcTemplate.queryForList()` trả về `List<Map>` — không có schema validation.

### Giải pháp

```java
// SAFE — dùng PreparedStatement với ?
String sql = "SELECT product_id, name, brand, price, image_url, description, stock, sku "
           + "FROM products WHERE name LIKE ? OR brand LIKE ?";
String param = "%" + keyword + "%";
return jdbcTemplate.queryForList(sql, param, param);
// Hoặc đơn giản hơn, dùng JPA:
return productRepository.findByNameContainingOrBrandContaining(keyword, keyword);
```
`?` placeholder không thể chứa `UNION` hay cấu trúc SQL — input được treat như literal string.

---

## Lỗ hổng 3 — Error-based SQLi

### Cơ chế hoạt động

**Endpoint:** `GET /api/products/{id}`

**Code dễ bị tấn công (`ProductService.java`):**
```java
String sql = "SELECT ... FROM products WHERE product_id=" + id;
try {
    return jdbcTemplate.queryForList(sql);
} catch (DataAccessException e) {
    throw new RuntimeException(e.getMostSpecificCause().getMessage()); // ← expose error
}
```

**Với input bình thường** (`1`), SQL bình thường:
```sql
SELECT ... FROM products WHERE product_id=1
```

**Với payload** (`1 AND extractvalue(1,concat(0x7e,(SELECT version())))`):
```sql
SELECT ... FROM products WHERE product_id=1
AND extractvalue(1, concat(0x7e, (SELECT version())))
```

`extractvalue()` là hàm XPath của MySQL. Khi tham số XPath không hợp lệ, MySQL **ném ra error chứa giá trị của subquery**:
```
XPATH syntax error: '~8.4.7'
              ↑ đây là kết quả của SELECT version()
```

Vì `server.error.include-message=always` trong `application.properties`, Spring Boot trả error message này trong JSON response → kẻ tấn công đọc được.

**Các payload nguy hiểm:**
```sql
-- Đọc tên database
1 AND extractvalue(1, concat(0x7e, (SELECT database())))
-- Kết quả: XPATH syntax error: '~HPBSports_DB'

-- Đọc password hash của admin
1 AND extractvalue(1, concat(0x7e, (SELECT password FROM users WHERE username='admin')))
-- Kết quả: XPATH syntax error: '~$2a$10$abc...'
```

### Nguyên nhân

1. Ghép `id` (String) trực tiếp vào SQL — `@PathVariable` đổi từ `Integer` → `String` loại bỏ validation kiểu dữ liệu.
2. Error message từ MySQL bị expose qua `getMostSpecificCause().getMessage()`.
3. `server.error.include-message=always` cho phép Spring trả message trong HTTP response.

### Giải pháp

```java
// SAFE
public Optional<Product> getProductById(Integer id) {  // ← Integer tự validate
    return productRepository.findById(id);
}
```
Dùng `Integer` làm kiểu dữ liệu — Spring tự throw 400 Bad Request nếu path variable không phải số nguyên, payload như `1 AND extractvalue(...)` không bao giờ đến tầng service.

Ngoài ra, trong production:
```properties
# application.properties
server.error.include-message=never
server.error.include-stacktrace=never
```

---

## Lỗ hổng 4 — Boolean-based Blind SQLi

### Cơ chế hoạt động

**Endpoint:** `GET /api/products/filter?brand=`

**Code dễ bị tấn công (`ProductService.java`):**
```java
if (brand != null && !brand.isBlank()) {
    sql.append(" AND brand='").append(brand).append("'"); // ← injection point
}
```

Loại tấn công này **không dùng UNION hay error message** — kẻ tấn công suy luận thông tin từ việc response có dữ liệu hay không (TRUE / FALSE).

**Payload TRUE** (`Yonex' AND 1=1-- `):
```sql
SELECT ... FROM products WHERE 1=1 AND brand='Yonex' AND 1=1-- '
```
→ `1=1` luôn đúng → trả về 4 sản phẩm Yonex.

**Payload FALSE** (`Yonex' AND 1=2-- `):
```sql
SELECT ... FROM products WHERE 1=1 AND brand='Yonex' AND 1=2-- '
```
→ `1=2` luôn sai → trả về 0 sản phẩm.

**Khai thác thực tế — đoán password hash từng ký tự:**
```sql
-- Payload: Yonex' AND SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$'-- 
-- TRUE (trả về 4 sp) → ký tự đầu của hash là '$'  (BCrypt luôn bắt đầu bằng $)
-- FALSE (trả về 0 sp) → ký tự đầu không phải '$'
```
Bằng cách lặp lại với từng vị trí (1, 2, 3, ...) và từng ký tự, kẻ tấn công tái tạo được toàn bộ password hash. `sqlmap` tự động hóa quá trình này.

### Nguyên nhân

- `brand` được ghép trực tiếp vào chuỗi SQL trong `StringBuilder.append()`.
- Response trả về lượng dữ liệu khác nhau tùy điều kiện SQL → kẻ tấn công dùng sự khác biệt này làm kênh truyền thông tin (side channel).

### Giải pháp

```java
// SAFE — dùng PreparedStatement
String sql = "SELECT ... FROM products WHERE 1=1"
           + (brand != null ? " AND brand=?" : "");
List<Object> params = new ArrayList<>();
if (brand != null) params.add(brand);
return jdbcTemplate.queryForList(sql, params.toArray());
// Hoặc dùng JPA Specification / Criteria API
```

---

## Lỗ hổng 5 — Time-based Blind SQLi

### Cơ chế hoạt động

**Endpoint:** `GET /api/customer/orders/my-orders/{userId}`

**Code dễ bị tấn công (`OrderService.java`):**
```java
StringBuilder sql = new StringBuilder(
    "SELECT ... FROM orders WHERE user_id=").append(userId); // ← injection point
```

Loại tấn công này **không cần response chứa dữ liệu** — kẻ tấn công đo **thời gian phản hồi** để suy luận thông tin. Nguy hiểm nhất vì không để lại dấu vết trên response body.

**Hàm `IF` + `SLEEP` trong MySQL:**
```sql
IF(condition, SLEEP(3), 0)
-- Nếu condition TRUE  → MySQL ngủ 3 giây → response delay 3s
-- Nếu condition FALSE → MySQL trả ngay   → response delay ~0s
```

**Payload** (`1 AND IF(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$',SLEEP(3),0)`):
```sql
SELECT ... FROM orders WHERE user_id=1
AND IF(
  SUBSTRING((SELECT password FROM users WHERE username='admin'), 1, 1) = '$',
  SLEEP(3),
  0
)
```

**Kịch bản khai thác:**
- Gửi payload với `='$'` → response mất 3 giây → ký tự đầu là `$` ✓
- Gửi payload với `='%'` → response ngay lập tức → ký tự đầu không phải `%` ✗
- Lặp lại 60–70 lần cho toàn bộ hash → tái tạo được password hash

**Điều kiện để SLEEP hoạt động:** Phải có ít nhất 1 dòng trong bảng orders khớp với `user_id=1`. Nếu bảng rỗng, MySQL không evaluate điều kiện WHERE → SLEEP không chạy.

### Nguyên nhân

- `userId` là `String` — không validate kiểu dữ liệu → nhận bất kỳ chuỗi nào.
- Ghép trực tiếp vào SQL: `WHERE user_id=` + userId.
- Kênh side channel (thời gian) đủ để rò rỉ thông tin dù response body không thay đổi.

### Giải pháp

```java
// SAFE
public List<Order> getMyOrders(Integer userId, String status, String keyword) {
    // userId là Integer → tự validate, không thể inject
    return orderRepository.findByUser_UserIdOrderByCreatedAtDesc(userId);
}
```
`Integer` type ở `@PathVariable` đảm bảo Spring từ chối bất kỳ giá trị nào không phải số nguyên thuần túy.

---

## So sánh 5 loại tấn công

| Loại | Cần response data? | Cần error message? | Tốc độ khai thác | Khó phát hiện |
|------|-------------------|--------------------|-----------------|---------------|
| Auth Bypass | Không (chỉ cần login thành công) | Không | Ngay lập tức | Thấp |
| UNION-based | Có (dữ liệu trả về trực tiếp) | Không | Nhanh | Thấp |
| Error-based | Có (error message) | Có | Nhanh | Thấp |
| Boolean Blind | Có (độ lớn response) | Không | Chậm (từng bit) | Trung bình |
| Time-based Blind | Không cần | Không | Rất chậm | Cao |

---

## Phòng chống chung (Defense in Depth)

| Tầng | Biện pháp |
|------|-----------|
| **Code** | Dùng Prepared Statement / Parameterized Query — đây là biện pháp **dứt điểm** |
| **ORM** | Dùng JPA/Hibernate — tự động parameterize mọi query |
| **Input validation** | Validate kiểu dữ liệu tại controller (`Integer`, `@Pattern`, `@Size`) |
| **Error handling** | `server.error.include-message=never` trong production |
| **WAF** | Web Application Firewall chặn payload SQLi phổ biến |
| **Least privilege** | DB user chỉ có quyền SELECT/INSERT/UPDATE trên bảng cần thiết, không có quyền `SHOW TABLES`, `information_schema` |
| **Monitoring** | Log và alert khi phát hiện ký tự đặc biệt (`'`, `--`, `UNION`, `SLEEP`) trong query param |

---

## Kết luận

Nguyên nhân gốc rễ của tất cả 5 lỗ hổng trên đều giống nhau: **ghép chuỗi user input vào SQL**. Giải pháp dứt điểm cũng chỉ có một: **không bao giờ ghép chuỗi — luôn dùng Parameterized Query**. Các biện pháp còn lại (WAF, monitoring, least privilege) là defense in depth, không thể thay thế cho việc viết code đúng.
