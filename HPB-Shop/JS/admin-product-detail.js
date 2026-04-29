const ADMIN_PRODUCTS_API_URL = "http://localhost:8080/api/admin/products";
const PRODUCT_IMAGE_BASE_PATH = "assets/image/";

let currentProduct = null;

document.addEventListener("DOMContentLoaded", () => {
    const user = window.AdminAuth?.requireAdmin();
    if (!user) return;

    window.AdminAuth.applyAdminName(user);
    window.AdminAuth.bindLogoutLinks();

    const productId = getProductIdFromQuery();
    if (!productId) {
        showError("Khong tim thay ma san pham trong duong dan.");
        return;
    }

    bindFormEvents();
    loadProduct(productId);
});

function getAuthHeaders(withJson = false) {
    return window.AdminAuth.authHeaders(withJson);
}

function getProductIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("id"));
    if (!Number.isFinite(id) || id <= 0) return null;
    return id;
}

function getProductName(product) {
    return product?.name || product?.productName || "San pham";
}

function getProductField(product, keys, fallback = "") {
    if (!product || !Array.isArray(keys)) return fallback;
    for (const key of keys) {
        const value = product[key];
        if (value !== null && value !== undefined && String(value).trim() !== "") {
            return value;
        }
    }
    return fallback;
}

function resolveProductImageUrl(rawImageUrl) {
    const fallback = "https://via.placeholder.com/500x500?text=No+Image";
    if (!rawImageUrl) return fallback;

    const normalized = String(rawImageUrl).trim().replace(/^['\"]+|['\"]+$/g, "");
    if (!normalized) return fallback;
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith("/")) return normalized;

    return `${PRODUCT_IMAGE_BASE_PATH}${normalized}`;
}

function formatCurrency(value) {
    return `${Number(value || 0).toLocaleString("vi-VN")}d`;
}

function showError(message) {
    const alertEl = document.getElementById("detail-alert");
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.classList.remove("d-none");
}

function clearError() {
    const alertEl = document.getElementById("detail-alert");
    if (!alertEl) return;
    alertEl.classList.add("d-none");
    alertEl.textContent = "";
}

async function loadProduct(id) {
    try {
        clearError();
        const response = await fetch(`${ADMIN_PRODUCTS_API_URL}/${id}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
        }

        currentProduct = await response.json();
        renderProduct(currentProduct);
        fillForm(currentProduct);
    } catch (error) {
        console.error(error);
        if (error.message === "HTTP_401" || error.message === "HTTP_403") {
            alert("Phien dang nhap da het han hoac khong du quyen. Vui long dang nhap lai.");
            window.location.href = "Dang-nhap.html";
            return;
        }

        showError("Khong tai duoc chi tiet san pham. Vui long thu lai.");
    }
}

function renderProduct(product) {
    document.getElementById("product-main-image").src = resolveProductImageUrl(
        getProductField(product, ["imageUrl", "image_url"], "")
    );
    document.getElementById("product-display-name").textContent = getProductName(product);
    document.getElementById("product-display-id").textContent = `#${getProductField(product, ["productId"], "-")}`;
    document.getElementById("product-display-price").textContent = formatCurrency(getProductField(product, ["price"], 0));

    document.getElementById("product-display-brand").textContent = getProductField(product, ["brand"], "-");
    document.getElementById("product-display-stock").textContent = Number(getProductField(product, ["stock"], 0)).toLocaleString("vi-VN");
    document.getElementById("product-display-sku").textContent = getProductField(product, ["sku"], "-");
    document.getElementById("product-display-weight").textContent = getProductField(product, ["weight_u", "weightU"], "-");
    document.getElementById("product-display-grip").textContent = getProductField(product, ["grip_g", "gripG"], "-");
    document.getElementById("product-display-tension").textContent = getProductField(product, ["tension"], "-");
    document.getElementById("product-display-balance-point").textContent = getProductField(product, ["balance_point", "balancePoint"], "-");
    document.getElementById("product-display-description").textContent = getProductField(product, ["description"], "Chua co mo ta");
}

function fillForm(product) {
    document.getElementById("field-name").value = getProductName(product);
    document.getElementById("field-brand").value = getProductField(product, ["brand"], "");
    document.getElementById("field-price").value = Number(getProductField(product, ["price"], 0));
    document.getElementById("field-stock").value = Number(getProductField(product, ["stock"], 0));
    document.getElementById("field-sku").value = getProductField(product, ["sku"], "");
    document.getElementById("field-weight-u").value = getProductField(product, ["weight_u", "weightU"], "");
    document.getElementById("field-grip-g").value = getProductField(product, ["grip_g", "gripG"], "");
    document.getElementById("field-tension").value = getProductField(product, ["tension"], "");
    document.getElementById("field-balance-point").value = getProductField(product, ["balance_point", "balancePoint"], "");
    document.getElementById("field-image-url").value = getProductField(product, ["imageUrl", "image_url"], "");
    document.getElementById("field-description").value = getProductField(product, ["description"], "");
}

function bindFormEvents() {
    const form = document.getElementById("admin-product-edit-form");
    const imageInput = document.getElementById("field-image-url");

    if (imageInput) {
        imageInput.addEventListener("input", () => {
            const preview = document.getElementById("product-main-image");
            if (!preview) return;
            preview.src = resolveProductImageUrl(imageInput.value);
        });
    }

    if (form) {
        form.addEventListener("submit", saveProduct);
    }
}

async function saveProduct(event) {
    event.preventDefault();
    if (!currentProduct?.productId) {
        showError("Khong xac dinh duoc san pham can cap nhat.");
        return;
    }

    const payload = {
        name: document.getElementById("field-name").value.trim(),
        brand: document.getElementById("field-brand").value.trim(),
        price: Number(document.getElementById("field-price").value),
        stock: Number(document.getElementById("field-stock").value),
        sku: document.getElementById("field-sku").value.trim() || null,
        weight_u: document.getElementById("field-weight-u").value.trim() || null,
        grip_g: document.getElementById("field-grip-g").value.trim() || null,
        tension: document.getElementById("field-tension").value.trim() || null,
        balance_point: document.getElementById("field-balance-point").value.trim() || null,
        imageUrl: document.getElementById("field-image-url").value.trim() || null,
        description: document.getElementById("field-description").value.trim() || null
    };

    if (!payload.name || !payload.brand) {
        alert("Ten san pham va thuong hieu la bat buoc.");
        return;
    }
    if (!Number.isFinite(payload.price) || payload.price < 0) {
        alert("Gia ban khong hop le.");
        return;
    }
    if (!Number.isFinite(payload.stock) || payload.stock < 0) {
        alert("So luong kho khong hop le.");
        return;
    }

    try {
        clearError();
        const response = await fetch(`${ADMIN_PRODUCTS_API_URL}/${currentProduct.productId}`, {
            method: "PUT",
            headers: getAuthHeaders(true),
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || "Khong luu duoc san pham");
        }

        currentProduct = await response.json();
        renderProduct(currentProduct);
        fillForm(currentProduct);
        alert("Cap nhat san pham thanh cong.");
    } catch (error) {
        console.error(error);
        alert(error.message || "Co loi khi cap nhat san pham.");
    }
}
