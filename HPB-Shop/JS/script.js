const API_PRODUCTS_URL = "http://localhost:8080/api/products";
const API_HOT_PRODUCTS_URL = `${API_PRODUCTS_URL}/hot?limit=3`;
const PRODUCT_IMAGE_BASE_PATH = "assets/image/";
const SUPPORTED_BRANDS = ["all", "Yonex", "Lining", "Victor", "Kumpoo", "VNB"];
const HOME_PRODUCTS_PAGE_SIZE = 8;
let currentBrand = "all";
let currentPage = 1;
let currentProducts = [];

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

function getInitialBrandFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const queryBrand = (params.get("brand") || "all").trim();
    const matchedBrand = SUPPORTED_BRANDS.find((brand) =>
        brand.toLowerCase() === queryBrand.toLowerCase()
    );
    return matchedBrand || "all";
}

function setActiveBrandButton(selectedBrand) {
    const filterContainer = document.getElementById("brand-filters");
    if (!filterContainer) {
        return;
    }

    const buttons = filterContainer.querySelectorAll("button[data-brand]");
    buttons.forEach((button) => {
        const buttonBrand = button.getAttribute("data-brand") || "all";
        if (buttonBrand.toLowerCase() === selectedBrand.toLowerCase()) {
            button.classList.remove("btn-outline-secondary");
            button.classList.add("btn-primary");
        } else {
            button.classList.remove("btn-primary");
            button.classList.add("btn-outline-secondary");
        }
    });
}

function updateBrandQuery(selectedBrand) {
    const url = new URL(window.location.href);
    if (selectedBrand.toLowerCase() === "all") {
        url.searchParams.delete("brand");
    } else {
        url.searchParams.set("brand", selectedBrand);
    }
    window.history.replaceState({}, "", url);
}

function scrollToProductSection() {
    const productList = document.getElementById("product-list");
    if (!productList) {
        return;
    }

    const productSection = productList.closest("section") || productList;
    productSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function getHotProducts(products) {
    if (!Array.isArray(products)) {
        return [];
    }

    return products.slice(0, 3);
}

function getNewestProducts(products) {
    if (!Array.isArray(products)) {
        return [];
    }

    return [...products]
        .sort((a, b) => {
            const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;

            if (timeB !== timeA) {
                return timeB - timeA;
            }

            return Number(b?.productId || 0) - Number(a?.productId || 0);
        })
        .slice(0, 3);
}

function renderHotProducts(products) {
    const container = document.getElementById("hot-product-list");
    if (!container) {
        return;
    }

    const hotProducts = getHotProducts(products);
    if (!hotProducts.length) {
        container.innerHTML = `
            <div class="col-12">
                <p class="text-center text-secondary mb-0">Chưa có dữ liệu sản phẩm hot.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = hotProducts.map((product, index) => {
        const rank = index + 1;
        return `
            <div class="col">
                <div class="card h-100 shadow-sm border-0 product-card hot-product-card position-relative">
                    <span class="hot-rank-badge">Top ${rank}</span>
                    <img src="${resolveProductImageUrl(product.imageUrl)}" class="card-img-top p-3" alt="${product.name}">
                    <div class="card-body text-center">
                        <h6 class="card-title text-truncate">${product.name}</h6>
                        <p class="text-danger fw-bold mb-1">${formatPrice(product.price)}</p>
                        <p class="small text-secondary mb-3">${product.brand || "HPB Sports"}</p>
                        <a href="Chi-tiet-san-pham.html?id=${product.productId}" class="btn btn-sm btn-primary w-100">Xem nhanh</a>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

function renderProducts(data) {
    const productList = document.getElementById("product-list");
    if (!productList) {
        return;
    }

    productList.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
        productList.innerHTML = `
            <div class="col-12">
                <p class="text-center text-secondary mb-0">Không có sản phẩm phù hợp.</p>
            </div>
        `;
        return;
    }

    data.forEach((product) => {
        const productId = product.productId;
        const productHTML = `
            <div class="col">
                <div class="card h-100 shadow-sm border-0 product-card">
                    <img src="${resolveProductImageUrl(product.imageUrl)}" class="card-img-top p-3" alt="${product.name}">
                    <div class="card-body text-center">
                        <h6 class="card-title text-truncate">${product.name}</h6>
                        <p class="text-danger fw-bold">${formatPrice(product.price)}</p>
                        <a href="Chi-tiet-san-pham.html?id=${productId}" class="btn btn-sm btn-outline-primary w-100">Xem chi tiết</a>
                    </div>
                </div>
            </div>
        `;
        productList.innerHTML += productHTML;
    });
}

function getTotalPages(totalItems, pageSize) {
    const safeSize = Math.max(1, Number(pageSize) || 1);
    return Math.max(1, Math.ceil(Number(totalItems || 0) / safeSize));
}

function getPagedItems(items, page, pageSize) {
    const source = Array.isArray(items) ? items : [];
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.max(1, Number(pageSize) || 1);
    const start = (safePage - 1) * safeSize;
    return source.slice(start, start + safeSize);
}

function renderHomePagination() {
    const paginationEl = document.getElementById("home-product-pagination");
    if (!paginationEl) {
        return;
    }

    const totalItems = currentProducts.length;
    const totalPages = getTotalPages(totalItems, HOME_PRODUCTS_PAGE_SIZE);
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    if (totalItems <= HOME_PRODUCTS_PAGE_SIZE) {
        paginationEl.innerHTML = "";
        return;
    }

    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }

    const prevDisabled = currentPage === 1 ? " disabled" : "";
    const nextDisabled = currentPage === totalPages ? " disabled" : "";

    let html = `
        <li class="page-item${prevDisabled}">
            <a class="page-link" href="#" data-page="prev">Trước</a>
        </li>
    `;

    for (let page = start; page <= end; page += 1) {
        const active = page === currentPage ? " active" : "";
        html += `
            <li class="page-item${active}">
                <a class="page-link" href="#" data-page="${page}">${page}</a>
            </li>
        `;
    }

    html += `
        <li class="page-item${nextDisabled}">
            <a class="page-link" href="#" data-page="next">Tiếp</a>
        </li>
    `;

    paginationEl.innerHTML = html;

    paginationEl.querySelectorAll("a.page-link[data-page]").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const action = link.getAttribute("data-page");
            if (action === "prev" && currentPage > 1) {
                currentPage -= 1;
            } else if (action === "next" && currentPage < totalPages) {
                currentPage += 1;
            } else if (!Number.isNaN(Number(action))) {
                currentPage = Number(action);
            }

            renderCurrentPageProducts();
            scrollToProductSection();
        });
    });
}

function renderCurrentPageProducts() {
    const pagedProducts = getPagedItems(currentProducts, currentPage, HOME_PRODUCTS_PAGE_SIZE);
    renderProducts(pagedProducts);
    renderHomePagination();
}

function updateProductData(products, resetPage = true) {
    currentProducts = Array.isArray(products) ? products : [];
    if (resetPage) {
        currentPage = 1;
    }
    renderCurrentPageProducts();
}

async function fetchProducts(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Không tải được dữ liệu sản phẩm");
    }
    return response.json();
}

async function loadProductsByBrand(brand) {
    currentBrand = brand;
    const endpoint = brand === "all"
        ? API_PRODUCTS_URL
        : `${API_PRODUCTS_URL}/brand/${encodeURIComponent(brand)}`;

    try {
        const products = await fetchProducts(endpoint);
        updateProductData(products, true);
    } catch (error) {
        console.error(error);
        updateProductData([], true);
    }
}

async function searchProducts(keyword) {
    const normalizedKeyword = (keyword || "").trim();

    if (!normalizedKeyword) {
        await loadProductsByBrand(currentBrand);
        return;
    }

    try {
        const results = await fetchProducts(`${API_PRODUCTS_URL}/search?keyword=${encodeURIComponent(normalizedKeyword)}`);
        if (currentBrand === "all") {
            updateProductData(results, true);
            return;
        }

        const filtered = results.filter((item) =>
            (item.brand || "").toLowerCase() === currentBrand.toLowerCase()
        );
        updateProductData(filtered, true);
    } catch (error) {
        console.error(error);
        updateProductData([], true);
    }
}

function setupBrandFilters() {
    const filterContainer = document.getElementById("brand-filters");
    if (!filterContainer) {
        return;
    }

    const buttons = filterContainer.querySelectorAll("button[data-brand]");
    buttons.forEach((button) => {
        button.addEventListener("click", async () => {
            const selectedBrand = button.getAttribute("data-brand") || "all";
            setActiveBrandButton(selectedBrand);
            updateBrandQuery(selectedBrand);

            const searchInput = document.getElementById("search-input");
            const keyword = searchInput ? searchInput.value.trim() : "";

            currentBrand = selectedBrand;
            if (keyword) {
                await searchProducts(keyword);
            } else {
                await loadProductsByBrand(selectedBrand);
            }
        });
    });
}

function setupSearchForm() {
    const searchForm = document.getElementById("search-form");
    const searchInput = document.getElementById("search-input");
    if (!searchForm || !searchInput) {
        return;
    }

    searchForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await searchProducts(searchInput.value);
        scrollToProductSection();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    setupAuthMenu();
    setupBrandFilters();
    setupSearchForm();

    try {
        const hotProducts = await fetchProducts(API_HOT_PRODUCTS_URL);
        renderHotProducts(hotProducts);
    } catch (error) {
        console.error(error);
        try {
            const fallbackProducts = await fetchProducts(API_PRODUCTS_URL);
            renderHotProducts(getNewestProducts(fallbackProducts));
        } catch (fallbackError) {
            console.error(fallbackError);
            renderHotProducts([]);
        }
    }

    const initialBrand = getInitialBrandFromQuery();
    setActiveBrandButton(initialBrand);
    await loadProductsByBrand(initialBrand);
});