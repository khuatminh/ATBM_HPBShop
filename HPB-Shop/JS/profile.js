const API_PROFILE_URL = "http://localhost:8080/api/customer/profile";

function getAuthData() {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const token = localStorage.getItem("token");
        return { user, token };
    } catch (error) {
        console.error(error);
        return { user: null, token: null };
    }
}

function setupAuthMenu() {
    const userMenu = document.querySelector(".header__navbar-user-menu");
    if (!userMenu) return;

    const { user } = getAuthData();
    if (!user || !user.userId) {
        userMenu.innerHTML = `
            <li class="header__navbar-user-item"><a href="Dang-nhap.html">Đăng nhập</a></li>
            <li class="header__navbar-user-item header__navbar-user-item--separate"><a href="Dang-ky.html">Đăng ký</a></li>
        `;
        return;
    }

    userMenu.innerHTML = `
        <li class="header__navbar-user-item"><a href="Ho-so.html">Hồ sơ</a></li>
        <li class="header__navbar-user-item"><a href="Don-mua.html">Đơn mua</a></li>
        <li class="header__navbar-user-item header__navbar-user-item--separate"><a href="Dang-nhap.html" data-action="logout">Đăng xuất</a></li>
    `;

    const logoutLink = userMenu.querySelector('[data-action="logout"]');
    if (logoutLink) {
        logoutLink.addEventListener("click", () => {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
        });
    }
}

function setGender(gender) {
    const normalized = (gender || "").toLowerCase();
    const male = document.getElementById("male");
    const female = document.getElementById("female");
    if (!male || !female) return;

    if (normalized.includes("nữ")) {
        female.checked = true;
    } else {
        male.checked = true;
    }
}

function getSelectedGender() {
    const selected = document.querySelector('input[name="gender"]:checked');
    return selected ? selected.value : "Nam";
}

function fillProfile(profile) {
    document.getElementById("profile-username").textContent = profile.username || "-";
    document.getElementById("sidebar-fullname").textContent = profile.fullname || profile.username || "Khách hàng";
    document.getElementById("profile-fullname").value = profile.fullname || "";
    document.getElementById("profile-email").value = profile.email || "";
    document.getElementById("profile-phone").value = profile.phone || "";
    setGender(profile.gender || "Nam");
}

async function loadProfile() {
    const { user, token } = getAuthData();
    if (!user || !user.userId || !token) {
        alert("Bạn cần đăng nhập để xem hồ sơ.");
        window.location.href = "Dang-nhap.html";
        return;
    }

    const response = await fetch(`${API_PROFILE_URL}/${user.userId}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Không tải được hồ sơ.");
    }

    const profile = await response.json();
    fillProfile(profile);
}

function setupProfileSubmit() {
    const form = document.getElementById("profileForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const { user, token } = getAuthData();
        if (!user || !user.userId || !token) {
            alert("Bạn cần đăng nhập để cập nhật hồ sơ.");
            window.location.href = "Dang-nhap.html";
            return;
        }

        const payload = {
            fullname: document.getElementById("profile-fullname").value.trim(),
            email: document.getElementById("profile-email").value.trim(),
            phone: document.getElementById("profile-phone").value.trim(),
            gender: getSelectedGender()
        };

        try {
            const response = await fetch(`${API_PROFILE_URL}/update/${user.userId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || "Không thể cập nhật hồ sơ.");
            }

            const updated = await response.json();
            localStorage.setItem("user", JSON.stringify(updated));
            fillProfile(updated);
            alert("Cập nhật hồ sơ thành công!");
        } catch (error) {
            console.error(error);
            alert(error.message || "Có lỗi khi cập nhật hồ sơ.");
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    setupAuthMenu();
    setupProfileSubmit();

    try {
        await loadProfile();
    } catch (error) {
        console.error(error);
        alert(error.message || "Không tải được hồ sơ.");
    }
});
