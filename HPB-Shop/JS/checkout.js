const API_ORDER_URL = "http://localhost:8080/api/customer/orders";
const PRODUCT_IMAGE_BASE_PATH = "assets/image/";
const SHIPPING_FEE = 50000;
const LOCATION_API_URL = "https://provinces.open-api.vn/api/?depth=3";

const PROVINCES_2025_34 = new Set([
    "ha noi",
    "hai phong",
    "hue",
    "da nang",
    "can tho",
    "ho chi minh",
    "an giang",
    "bac ninh",
    "ca mau",
    "cao bang",
    "dak lak",
    "dien bien",
    "dong nai",
    "dong thap",
    "gia lai",
    "ha tinh",
    "hung yen",
    "khanh hoa",
    "lai chau",
    "lam dong",
    "lang son",
    "lao cai",
    "nghe an",
    "ninh binh",
    "phu tho",
    "quang ngai",
    "quang ninh",
    "quang tri",
    "son la",
    "tay ninh",
    "thai nguyen",
    "thanh hoa",
    "tuyen quang",
    "vinh long"
]);

let locationData = [];

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
    const fallback = "https://via.placeholder.com/80x80?text=No+Image";
    if (!rawImageUrl) return fallback;
    const normalized = String(rawImageUrl).trim().replace(/^['\"]+|['\"]+$/g, "");
    if (!normalized) return fallback;
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith("/")) return normalized;
    return `${PRODUCT_IMAGE_BASE_PATH}${normalized}`;
}

async function fetchCartItems() {
    const { user, token } = getAuthData();
    if (!user || !user.userId || !token) {
        throw new Error("Bạn cần đăng nhập trước khi thanh toán.");
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

function renderCheckoutItems(items) {
    const container = document.getElementById("checkout-items");
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `<div class="text-secondary small">Giỏ hàng của bạn đang trống.</div>`;
        return;
    }

    container.innerHTML = items.map((item) => {
        const product = item.product || {};
        const quantity = Number(item.quantity || 0);
        const total = Number(product.price || 0) * quantity;
        return `
            <div class="checkout-item d-flex align-items-center py-3 border-bottom">
                <div class="item-img-circle me-3">
                    <img src="${resolveImage(product.imageUrl)}" alt="${product.name || "Sản phẩm"}">
                </div>
                <div class="flex-grow-1">
                    <h6 class="small fw-bold mb-1">${product.name || "Sản phẩm"}</h6>
                    <div class="small text-secondary">Số lượng: ${quantity}</div>
                </div>
                <div class="text-end">
                    <span class="fw-bold small">${formatPrice(total)}</span>
                </div>
            </div>
        `;
    }).join("");
}

function updateSummary(items) {
    const subtotal = items.reduce((sum, item) => {
        const price = Number(item.product?.price || 0);
        const quantity = Number(item.quantity || 0);
        return sum + (price * quantity);
    }, 0);

    const total = subtotal + (items.length > 0 ? SHIPPING_FEE : 0);

    const subtotalEl = document.getElementById("checkout-subtotal");
    const shippingEl = document.getElementById("checkout-shipping");
    const totalEl = document.getElementById("checkout-total");

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (shippingEl) shippingEl.textContent = items.length > 0 ? formatPrice(SHIPPING_FEE) : formatPrice(0);
    if (totalEl) totalEl.textContent = formatPrice(total);
}

function getSelectedPaymentMethod() {
    const selected = document.querySelector('input[name="pay"]:checked');
    return selected ? selected.value : "COD";
}

function resetSelect(selectEl, placeholder, disabled = true) {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    selectEl.disabled = disabled;
}

function fillSelect(selectEl, placeholder, items) {
    if (!selectEl) return;
    const options = (items || []).map((item) => {
        return `<option value="${item.code}">${item.name}</option>`;
    }).join("");

    selectEl.innerHTML = `<option value="">${placeholder}</option>${options}`;
    selectEl.disabled = !Array.isArray(items) || items.length === 0;
}

function normalizeProvinceName(name) {
    return String(name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^thanh pho\s+/i, "")
        .replace(/^tinh\s+/i, "")
        .trim()
        .toLowerCase();
}

function filterTo34Provinces(items) {
    const source = Array.isArray(items) ? items : [];
    return source.filter((province) => PROVINCES_2025_34.has(normalizeProvinceName(province?.name)));
}

function getAddressParts() {
    const provinceEl = document.getElementById("checkout-province");
    const wardEl = document.getElementById("checkout-ward");

    const provinceName = provinceEl?.options[provinceEl.selectedIndex]?.text || "";
    const wardName = wardEl?.options[wardEl.selectedIndex]?.text || "";

    return {
        provinceCode: provinceEl?.value || "",
        wardCode: wardEl?.value || "",
        provinceName: provinceEl?.value ? provinceName : "",
        wardName: wardEl?.value ? wardName : ""
    };
}

function composeFullAddress(detailAddress) {
    const { provinceName, wardName } = getAddressParts();
    const parts = [detailAddress, wardName, provinceName].filter(Boolean);
    return parts.join(", ");
}

function flattenLocalLevelUnits(province) {
    const districts = province?.districts || [];
    const units = districts.flatMap((district) => {
        return (district.wards || []).map((ward) => ({
            code: `${district.code}-${ward.code}`,
            name: ward.name
        }));
    });

    return units
        .filter((unit) => String(unit?.name || "").trim())
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "vi"));
}

async function initializeLocationSelectors() {
    const provinceEl = document.getElementById("checkout-province");
    const wardEl = document.getElementById("checkout-ward");

    if (!provinceEl || !wardEl) return;

    resetSelect(provinceEl, "Chọn Tỉnh / Thành phố", true);
    resetSelect(wardEl, "Chọn Xã / Phường / Đặc khu", true);

    try {
        const response = await fetch(LOCATION_API_URL);
        if (!response.ok) {
            throw new Error("Không tải được dữ liệu địa chỉ.");
        }

        const rawLocationData = await response.json();
        locationData = filterTo34Provinces(rawLocationData);

        if (locationData.length !== 34) {
            console.warn("Danh sách cấp tỉnh hiện tại không đủ 34 đơn vị theo cấu hình.", {
                expected: 34,
                actual: locationData.length
            });
        }

        fillSelect(provinceEl, "Chọn Tỉnh / Thành phố", locationData);

        provinceEl.addEventListener("change", () => {
            const selectedProvince = locationData.find(
                (province) => String(province.code) === String(provinceEl.value)
            );

            if (!selectedProvince) {
                resetSelect(wardEl, "Chọn Xã / Phường / Đặc khu", true);
                return;
            }

            const localUnits = flattenLocalLevelUnits(selectedProvince);

            if (!localUnits.length) {
                resetSelect(wardEl, "Tỉnh này hiện chưa có dữ liệu Xã / Phường / Đặc khu", true);
                return;
            }

            fillSelect(wardEl, "Chọn Xã / Phường / Đặc khu", localUnits);
        });
    } catch (error) {
        console.error(error);
        alert("Không thể tải danh sách Tỉnh/Thành và Xã/Phường/Đặc khu. Vui lòng tải lại trang.");
    }
}

function setupCheckoutSubmit() {
    const submitBtn = document.getElementById("checkout-submit");
    if (!submitBtn) return;

    submitBtn.addEventListener("click", async () => {
        const { user, token } = getAuthData();
        if (!user || !user.userId || !token) {
            alert("Bạn cần đăng nhập trước khi thanh toán.");
            window.location.href = "Dang-nhap.html";
            return;
        }

        const addressInput = document.getElementById("checkout-address");
        const phoneInput = document.getElementById("checkout-phone");
        const provinceEl = document.getElementById("checkout-province");
        const wardEl = document.getElementById("checkout-ward");

        const detailAddress = (addressInput?.value || "").trim();
        const phone = (phoneInput?.value || "").trim();

        if (!provinceEl?.value || !wardEl?.value) {
            alert("Vui lòng chọn đầy đủ Tỉnh/Thành và Xã/Phường/Đặc khu.");
            return;
        }

        if (!detailAddress || !phone) {
            alert("Vui lòng nhập đầy đủ địa chỉ chi tiết và số điện thoại.");
            return;
        }

        const address = composeFullAddress(detailAddress);

        const payload = {
            userId: user.userId,
            paymentMethod: getSelectedPaymentMethod(),
            address,
            phone
        };

        try {
            const response = await fetch(`${API_ORDER_URL}/checkout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || "Không thể thanh toán");
            }

            alert("Đặt hàng thành công!");
            window.location.href = "Don-mua.html";
        } catch (error) {
            console.error(error);
            alert(error.message || "Có lỗi khi thanh toán.");
        }
    });
}

async function initializeCheckout() {
    try {
        const items = await fetchCartItems();
        renderCheckoutItems(items);
        updateSummary(items);

        const submitBtn = document.getElementById("checkout-submit");
        if (submitBtn && (!Array.isArray(items) || items.length === 0)) {
            submitBtn.disabled = true;
        }
    } catch (error) {
        console.error(error);
        const container = document.getElementById("checkout-items");
        if (container) {
            container.innerHTML = `<div class="text-danger small">${error.message}</div>`;
        }

        const submitBtn = document.getElementById("checkout-submit");
        if (submitBtn) submitBtn.disabled = true;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await initializeLocationSelectors();
    setupCheckoutSubmit();
    await initializeCheckout();
});
