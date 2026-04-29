# HPB-Shop
cửa hàng chuyên bán vợt cầu lông trên thế giới
🏸 HPB Sports - Hệ Thống Quản Lý Kinh Doanh Phụ Kiện Cầu Lông
HPB Sports là một ứng dụng web thương mại điện tử chuyên biệt cho phụ kiện cầu lông, cho phép người dùng tìm kiếm, đặt mua sản phẩm và quản trị viên quản lý kho hàng, đơn hàng một cách hiệu quả.

✨ Tính Năng Chính
👤 Phía Khách Hàng (Customer)
Khám phá sản phẩm: Xem danh sách vợt, tìm kiếm theo tên và lọc nâng cao theo thương hiệu (Yonex, Lining, Victor...) và khoảng giá.

Chi tiết sản phẩm: Xem thông số kỹ thuật, hình ảnh và tình trạng kho.

Giỏ hàng & Thanh toán: Thêm sản phẩm vào giỏ, cập nhật số lượng và tiến hành đặt hàng với phí vận chuyển tự động.

Quản lý đơn mua: * Theo dõi trạng thái đơn hàng (Chờ xử lý, Đang giao, Hoàn thành).

Hủy đơn hàng khi còn ở trạng thái chờ.

Mua lại: Một chạm để thêm lại toàn bộ sản phẩm từ đơn cũ vào giỏ hàng.

Hồ sơ cá nhân: Cập nhật thông tin, giới tính và địa chỉ nhận hàng.

🔐 Phía Quản Trị Viên (Admin)
Dashboard Thống kê: Theo dõi tổng đơn hàng, doanh thu thực tế và biểu đồ tăng trưởng.

Quản lý Sản phẩm: Thêm, sửa, xóa và theo dõi biến động kho hàng (Inventory Logs).

Duyệt Đơn Hàng: Xử lý luồng đơn hàng và tự động hoàn kho khi đơn bị hủy.

Quản lý Người dùng: Theo dõi danh sách thành viên và kiểm soát trạng thái tài khoản.

🛠 Công Nghệ Sử Dụng
Backend: Java 25, Spring Boot 4.0.3.

Database: MySQL 9.4.

ORM: Spring Data JPA (Hibernate 7.2).

Security: Spring Security (Xử lý phân quyền Customer/Admin).

API Documentation: Swagger / OpenAPI 3.

Frontend: HTML5, CSS3, JavaScript (Fetch API), Bootstrap 5.

🚀 Hướng Dẫn Cài Đặt
1. Tiền đề (Prerequisites)
Java SDK 25.

MySQL Server.

Maven.

2. Cấu hình Cơ sở dữ liệu
Tạo database tên HPBSports_DB trong MySQL và cập nhật thông tin vào file src/main/resources/application.properties:

Properties
spring.datasource.url=jdbc:mysql://localhost:3306/HPBSports_DB
spring.datasource.username=YOUR_USERNAME
spring.datasource.password=YOUR_PASSWORD
3. Chạy ứng dụng
Mở Terminal tại thư mục gốc và chạy lệnh:

Bash
mvn spring-boot:run
Sau đó truy cập:

Frontend: http://localhost:8080/Trang-chu.html

Swagger UI: http://localhost:8080/swagger-ui.html

📸 Hình Ảnh Dự Án

📝 Tác Giả
Họ tên: Mai Anh Hoàng

Trường: Học viện Công nghệ Bưu chính Viễn thông (PTIT)

Email: maianhhoang123@gmail.com

Cảm ơn bro đã ghé thăm Repository của mình! Đừng quên nhấn ⭐ nếu thấy dự án hữu ích nhé!
