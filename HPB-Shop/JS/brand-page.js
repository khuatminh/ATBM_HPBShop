const API_PRODUCTS_URL = "http://localhost:8080/api/products";
const PRODUCT_IMAGE_BASE_PATH = "assets/image/";
const BRANDS = ["Yonex", "Lining", "Victor", "Kumpoo", "VNB"];

let currentBrand = "Yonex";
let productsByBrand = [];

function getCurrentUser() {
    try {
        const rawUser = localStorage.getItem("user");
        return rawUser ? JSON.parse(rawUser) : null;
    } catch (error) {
        console.error("Không đọc được user trong localStorage:", error);
        return null;
    }
}

function setupAuthMenu() {
    const userMenu = document.querySelector(".header__navbar-user-menu");
    if (!userMenu) {
        return;
    }

    const currentUser = getCurrentUser();

    if (!currentUser || !currentUser.userId) {
        userMenu.innerHTML = `
            <li class="header__navbar-user-item">
                <a href="Dang-nhap.html">Đăng nhập</a>
            </li>
            <li class="header__navbar-user-item header__navbar-user-item--separate">
                <a href="Dang-ky.html">Đăng ký</a>
            </li>
        `;
        return;
    }

    userMenu.innerHTML = `
        <li class="header__navbar-user-item">
            <a href="Ho-so.html">Hồ sơ</a>
        </li>
        <li class="header__navbar-user-item">
            <a href="Don-mua.html">Đơn mua</a>
        </li>
        <li class="header__navbar-user-item header__navbar-user-item--separate">
            <a href="Dang-nhap.html" data-action="logout">Đăng xuất</a>
        </li>
    `;

    const logoutLink = userMenu.querySelector('[data-action="logout"]');
    if (logoutLink) {
        logoutLink.addEventListener("click", () => {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
        });
    }
}

function formatPrice(price) {
    const numericPrice = Number(price || 0);
    return `${numericPrice.toLocaleString("vi-VN")} ₫`;
}

function resolveProductImageUrl(rawImageUrl) {
    const fallback = "https://via.placeholder.com/400x400?text=No+Image";
    if (!rawImageUrl) {
        return fallback;
    }

    const normalized = String(rawImageUrl).trim().replace(/^['\"]+|['\"]+$/g, "");
    if (!normalized) {
        return fallback;
    }

    if (/^https?:\/\//i.test(normalized)) {
        return normalized;
    }

    if (normalized.startsWith("/")) {
        return normalized;
    }

    return `${PRODUCT_IMAGE_BASE_PATH}${normalized}`;
}

function normalizeBrand(brand) {
    const value = (brand || "").trim();
    const matched = BRANDS.find((item) => item.toLowerCase() === value.toLowerCase());
    return matched || "Yonex";
}

function getBrandFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return normalizeBrand(params.get("brand"));
}

function updateBrandQuery(brand) {
    const url = new URL(window.location.href);
    url.searchParams.set("brand", brand);
    window.history.replaceState({}, "", url);
}

function setupBrandFilterList() {
    const container = document.getElementById("brand-filter-list");
    if (!container) {
        return;
    }

    container.innerHTML = BRANDS.map((brand, index) => {
        const id = `brand-${index}`;
        const checked = brand === currentBrand ? "checked" : "";
        return `
            <div class="form-check mb-2 small">
                <input class="form-check-input brand-filter" type="radio" name="brandFilter" id="${id}" value="${brand}" ${checked}>
                <label class="form-check-label" for="${id}">${brand}</label>
            </div>
        `;
    }).join("");

    const brandRadios = container.querySelectorAll(".brand-filter");
    brandRadios.forEach((radio) => {
        radio.addEventListener("change", async (event) => {
            const selectedBrand = normalizeBrand(event.target.value);
            currentBrand = selectedBrand;
            updateBrandQuery(selectedBrand);
            updateBrandLabels(selectedBrand);
            await loadProductsByBrand(selectedBrand);
            applyAndRender();
        });
    });
}

function updateBrandLabels(brand) {
    const breadcrumbBrand = document.getElementById("breadcrumb-brand");
    const breadcrumbTitle = document.getElementById("breadcrumb-title");
    const brandPageTitle = document.getElementById("brand-page-title");

    const upperBrand = brand.toUpperCase();
    const titleText = `Vợt cầu lông ${brand}`;

    if (breadcrumbBrand) breadcrumbBrand.textContent = upperBrand;
    if (breadcrumbTitle) breadcrumbTitle.textContent = titleText;
    if (brandPageTitle) brandPageTitle.textContent = titleText;

    document.title = `${titleText} - HPB Sports`;
}

function renderProducts(items) {
    const list = document.getElementById("brand-product-list");
    if (!list) {
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        list.innerHTML = `
            <div class="col-12">
                <div class="alert alert-light border text-center mb-0">Không có sản phẩm phù hợp.</div>
            </div>
        `;
        return;
    }

    list.innerHTML = items.map((product) => `
        <div class="col">
            <div class="card h-100 border-0 product-card-hover">
                <div class="position-relative">
                    <span class="badge bg-warning text-dark position-absolute top-0 end-0 m-2">${product.brand || "Brand"}</span>
                    <img src="${resolveProductImageUrl(product.imageUrl)}" class="card-img-top p-3" alt="${product.name}">
                </div>
                <div class="card-body">
                    <h6 class="card-title small fw-bold mb-2">${product.name}</h6>
                    <span class="text-danger fw-bold">${formatPrice(product.price)}</span>
                    <div class="mt-3">
                        <a href="Chi-tiet-san-pham.html?id=${product.productId}" class="btn btn-sm btn-outline-primary w-100">Xem chi tiết</a>
                    </div>
                </div>
            </div>
        </div>
    `).join("");
}

async function fetchProducts(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Không tải được dữ liệu sản phẩm");
    }
    return response.json();
}

async function loadProductsByBrand(brand) {
    const endpoint = `${API_PRODUCTS_URL}/brand/${encodeURIComponent(brand)}`;
    productsByBrand = await fetchProducts(endpoint);
}

function filterBySearchKeyword(items) {
    const input = document.getElementById("brand-search-input");
    const keyword = (input ? input.value : "").trim().toLowerCase();
    if (!keyword) {
        return items;
    }
    return items.filter((product) => (product.name || "").toLowerCase().includes(keyword));
}

function inPriceRange(price, range) {
    const value = Number(price || 0);
    switch (range) {
        case "lt-500":
            return value < 500000;
        case "500-1000":
            return value >= 500000 && value <= 1000000;
        case "1000-2000":
            return value > 1000000 && value <= 2000000;
        case "gt-3000":
            return value > 3000000;
        default:
            return true;
    }
}

function filterByPrice(items) {
    const selectedRanges = Array.from(document.querySelectorAll(".price-filter:checked")).map((input) => input.dataset.range);
    if (selectedRanges.length === 0) {
        return items;
    }

    return items.filter((product) => selectedRanges.some((range) => inPriceRange(product.price, range)));
}

function sortProducts(items) {
    const sortSelect = document.getElementById("sort-select");
    const sortType = sortSelect ? sortSelect.value : "default";

    const cloned = [...items];
    if (sortType === "price-asc") {
        cloned.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortType === "price-desc") {
        cloned.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    return cloned;
}

function applyAndRender() {
    const searched = filterBySearchKeyword(productsByBrand);
    const priced = filterByPrice(searched);
    const sorted = sortProducts(priced);
    renderProducts(sorted);
}

function setupSearch() {
    const form = document.getElementById("brand-search-form");
    if (!form) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        applyAndRender();
    });
}

function setupPriceFilters() {
    const priceFilters = document.querySelectorAll(".price-filter");
    priceFilters.forEach((input) => {
        input.addEventListener("change", () => {
            applyAndRender();
        });
    });
}

function setupSort() {
    const sortSelect = document.getElementById("sort-select");
    if (!sortSelect) {
        return;
    }

    sortSelect.addEventListener("change", () => {
        applyAndRender();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    setupAuthMenu();

    try {
        currentBrand = getBrandFromQuery();
        updateBrandLabels(currentBrand);
        setupBrandFilterList();
        setupSearch();
        setupPriceFilters();
        setupSort();

        await loadProductsByBrand(currentBrand);
        applyAndRender();
    } catch (error) {
        console.error(error);
        renderProducts([]);
    }
});
