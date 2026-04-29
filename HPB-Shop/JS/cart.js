const API_CART_URL = "http://localhost:8080/api/customer/cart";
const API_ORDER_URL = "http://localhost:8080/api/customer/orders";
const PRODUCT_IMAGE_BASE_PATH = "assets/image/";

function getCurrentUser() {
    try {
        const rawUser = localStorage.getItem("user");
        return rawUser ? JSON.parse(rawUser) : null;
    } catch (error) {
        console.error(error);
        return null;
    }
}

function getAuthData() {
    const user = getCurrentUser();
    const token = localStorage.getItem("token");
    return { user, token };
}

function formatPrice(price) {
    const value = Number(price || 0);
    return `${value.toLocaleString("vi-VN")} ₫`;
}

function resolveImage(rawImageUrl) {
    const fallback = "https://via.placeholder.com/120x120?text=No+Image";
    if (!rawImageUrl) return fallback;
    const normalized = String(rawImageUrl).trim().replace(/^['\"]+|['\"]+$/g, "");
    if (!normalized) return fallback;
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith("/")) return normalized;
    return `${PRODUCT_IMAGE_BASE_PATH}${normalized}`;
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

async function fetchCartItems() {
    const { user, token } = getAuthData();
    if (!user || !user.userId || !token) {
        throw new Error("Bạn cần đăng nhập để xem giỏ hàng.");
    }

    const response = await fetch(`${API_ORDER_URL}/cart/${user.userId}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Không tải được giỏ hàng");
    }

    return response.json();
}

async function updateQuantity(cartItemId, quantity) {
    const { token } = getAuthData();
    const response = await fetch(`${API_CART_URL}/${cartItemId}?quantity=${quantity}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Không thể cập nhật số lượng");
    }
}

async function removeItem(cartItemId) {
    const { token } = getAuthData();
    const response = await fetch(`${API_CART_URL}/${cartItemId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Không thể xóa sản phẩm");
    }
}

function updateSummary(items) {
    const subtotal = items.reduce((sum, item) => {
        const price = Number(item.product?.price || 0);
        const quantity = Number(item.quantity || 0);
        return sum + (price * quantity);
    }, 0);

    const subtotalEl = document.getElementById("subtotal-value");
    const totalEl = document.getElementById("total-value");
    const checkoutLink = document.getElementById("checkout-link");

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (totalEl) totalEl.textContent = formatPrice(subtotal);

    if (checkoutLink) {
        if (items.length === 0) {
            checkoutLink.classList.add("disabled");
            checkoutLink.setAttribute("aria-disabled", "true");
        } else {
            checkoutLink.classList.remove("disabled");
            checkoutLink.removeAttribute("aria-disabled");
        }
    }
}

function renderCartItems(items) {
    const tbody = document.getElementById("cart-items");
    if (!tbody) return;

    if (!Array.isArray(items) || items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-secondary small">Giỏ hàng đang trống.</td>
            </tr>
        `;
        updateSummary([]);
        return;
    }

    tbody.innerHTML = items.map((item) => {
        const product = item.product || {};
        const quantity = Number(item.quantity || 1);
        const price = Number(product.price || 0);
        const total = price * quantity;

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${resolveImage(product.imageUrl)}" class="rounded border me-3" width="70" alt="${product.name || "Sản phẩm"}">
                        <div>
                            <h6 class="mb-0 small fw-bold">${product.name || "Sản phẩm"}</h6>
                            <small class="text-secondary">SKU: ${product.sku || "-"}</small>
                        </div>
                    </div>
                </td>
                <td class="small">${formatPrice(price)}</td>
                <td>
                    <div class="input-group input-group-sm qty-box">
                        <button class="btn btn-outline-secondary" data-action="decrease" data-id="${item.cartItemId}" data-qty="${quantity}">-</button>
                        <input type="text" class="form-control text-center" value="${quantity}" readonly>
                        <button class="btn btn-outline-secondary" data-action="increase" data-id="${item.cartItemId}" data-qty="${quantity}">+</button>
                    </div>
                </td>
                <td class="text-end fw-bold small">${formatPrice(total)}</td>
                <td class="text-end">
                    <button class="btn btn-link text-danger p-0" data-action="remove" data-id="${item.cartItemId}"><i class="fa-regular fa-trash-can"></i></button>
                </td>
            </tr>
        `;
    }).join("");

    updateSummary(items);
}

async function refreshCart() {
    try {
        const items = await fetchCartItems();
        renderCartItems(items);
    } catch (error) {
        console.error(error);
        const tbody = document.getElementById("cart-items");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger small">${error.message}</td></tr>`;
        }
        updateSummary([]);
    }
}

function setupCartActions() {
    const tbody = document.getElementById("cart-items");
    if (!tbody) return;

    tbody.addEventListener("click", async (event) => {
        const target = event.target.closest("button[data-action]");
        if (!target) return;

        const action = target.dataset.action;
        const cartItemId = Number(target.dataset.id);
        const currentQty = Number(target.dataset.qty || 1);

        try {
            if (action === "increase") {
                await updateQuantity(cartItemId, currentQty + 1);
            } else if (action === "decrease") {
                if (currentQty > 1) {
                    await updateQuantity(cartItemId, currentQty - 1);
                }
            } else if (action === "remove") {
                await removeItem(cartItemId);
            }
            await refreshCart();
        } catch (error) {
            console.error(error);
            alert(error.message || "Có lỗi khi thao tác giỏ hàng.");
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    setupAuthMenu();
    setupCartActions();
    await refreshCart();
});
