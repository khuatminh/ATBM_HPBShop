const API_BASE_URL = "http://localhost:8080/api/auth";

// Xử lý sự kiện đăng ký
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Chặn load lại trang

            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                alert("Mật khẩu nhập lại không khớp!");
                return;
            }

            const userData = {
                fullname: document.getElementById('fullname').value,
                email: document.getElementById('email').value,
                username: document.getElementById('username').value,
                password: password,
                phone: document.getElementById('phone').value
            };

            try {
                const response = await fetch(`${API_BASE_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                if (response.ok) {
                    alert("Đăng ký thành công!");
                    window.location.href = "Dang-nhap.html";
                } else {
                    const message = await response.text();
                    alert(message || "Đăng ký thất bại. Vui lòng thử lại!");
                }
            } catch (err) {
                alert("Không kết nối được đến Server!");
            }
        });
    }
});

// --- LOGIC ĐĂNG NHẬP ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Lấy giá trị từ ô nhập (đặt tên là loginId cho rõ nghĩa)
        const loginId = document.getElementById('username').value; 
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 2. Gửi key 'loginId' để khớp với AuthController
                body: JSON.stringify({ loginId, password }) 
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.user;
                const token = data.token;
                
                if (user && user.userId && token) {
                    localStorage.setItem('user', JSON.stringify(user));
                    localStorage.setItem('token', token);
                    
                    alert(`Chào mừng ${user.fullname} đã quay trở lại!`);
                    
                    if (user.role === 'admin') {
                        window.location.href = "Admin-dashboard.html";
                    } else {
                        window.location.href = "Trang-chu.html";
                    }
                } else {
                    alert("Sai tài khoản hoặc mật khẩu, check lại đi fen!");
                }
            } else {
                const message = await response.text();
                alert(message || "Đăng nhập thất bại. Tài khoản không tồn tại hoặc mật khẩu sai!");
            }
        } catch (error) {
            console.error("Lỗi kết nối:", error);
            alert("Server đang bận hoặc chưa bật kìa bro!");
        }
    });
}