const API_URL = "http://localhost:8080/api/admin/products";
const PRODUCT_IMAGE_BASE_PATH = "assets/image/";
const PRODUCTS_PAGE_SIZE = 8;

let allProducts = [];
let filteredProducts = [];
let currentProductPage = 1;

document.addEventListener('DOMContentLoaded', () => {
    const user = window.AdminAuth?.requireAdmin();
    if (!user) return;
    window.AdminAuth.applyAdminName(user);
    window.AdminAuth.bindLogoutLinks();

    bindProductSearch();
    loadProducts();
});

function getAuthHeaders(withJson = false) {
    return window.AdminAuth.authHeaders(withJson);
}

function getProductName(product) {
    return product.name || product.productName || 'Sản phẩm';
}

function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .trim();
}

function resolveProductImageUrl(rawImageUrl) {
    const fallback = 'https://via.placeholder.com/120x120?text=No+Image';
    if (!rawImageUrl) return fallback;

    const normalized = String(rawImageUrl).trim().replace(/^['\"]+|['\"]+$/g, '');
    if (!normalized) return fallback;
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith('/')) return normalized;

    return `${PRODUCT_IMAGE_BASE_PATH}${normalized}`;
}

// 2. Load danh sách sản phẩm & Thống kê
async function loadProducts() {
    try {
        const res = await fetch(API_URL, { headers: getAuthHeaders() });
        if (!res.ok) {
            throw new Error(`HTTP_${res.status}`);
        }
        allProducts = await res.json();

        applyProductFilters(false);
        renderStats(allProducts);
    } catch (err) {
        console.error("Lỗi kết nối BE:", err);
        if (err.message === 'HTTP_401' || err.message === 'HTTP_403') {
            alert('Phiên đăng nhập đã hết hạn hoặc không đủ quyền. Vui lòng đăng nhập lại.');
            window.location.href = 'Dang-nhap.html';
        }
    }
}

function getTotalPages(totalItems, pageSize) {
    const size = Number(pageSize) > 0 ? Number(pageSize) : 1;
    return Math.max(1, Math.ceil(Number(totalItems || 0) / size));
}

function getPagedItems(items, currentPage, pageSize) {
    const source = Array.isArray(items) ? items : [];
    const safePage = Math.max(1, Number(currentPage) || 1);
    const safePageSize = Math.max(1, Number(pageSize) || 1);
    const start = (safePage - 1) * safePageSize;
    return source.slice(start, start + safePageSize);
}

function renderCurrentProductPage() {
    const totalPages = getTotalPages(filteredProducts.length, PRODUCTS_PAGE_SIZE);
    currentProductPage = Math.min(Math.max(1, currentProductPage), totalPages);

    const pagedProducts = getPagedItems(filteredProducts, currentProductPage, PRODUCTS_PAGE_SIZE);
    renderTable(pagedProducts);
    renderPagination(filteredProducts.length, currentProductPage, PRODUCTS_PAGE_SIZE);
}

function applyProductFilters(resetPage = true) {
    const searchInput = document.getElementById('product-search-input');
    const keyword = normalizeSearchText(searchInput?.value);

    filteredProducts = allProducts.filter((product) => {
        if (!keyword) return true;

        const searchable = [
            product.productId,
            getProductName(product)
        ].join(' ');

        return normalizeSearchText(searchable).includes(keyword);
    });

    if (resetPage) currentProductPage = 1;
    renderCurrentProductPage();
}

function bindProductSearch() {
    const searchInput = document.getElementById('product-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        applyProductFilters();
    });
}

function renderTable(data) {
    const tableBody = document.getElementById('productTableBody');
    if (!tableBody) return;

    if (!Array.isArray(data) || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-secondary">Không có sản phẩm để hiển thị.</td></tr>';
        return;
    }

    const html = data.map(p => `
        <tr>
            <td class="text-secondary">#${p.productId}</td>
            <td><img src="${resolveProductImageUrl(p.imageUrl)}" class="product-img-td border"></td>
            <td class="fw-bold">${getProductName(p)}</td>
            <td><span class="badge badge-brand">${p.brand}</span></td>
            <td class="fw-bold">${Number(p.price || 0).toLocaleString('vi-VN')}đ</td>
            <td><span class="fw-bold ${p.stock < 5 ? 'text-danger' : ''}">${p.stock}</span></td>
            <td class="text-end">
                <button class="btn btn-light btn-sm me-1" onclick="openAdminProductDetail(${p.productId})"><i class="fa-solid fa-pen-to-square text-primary"></i></button>
                <button class="btn btn-light btn-sm" onclick="deleteProduct(${p.productId})"><i class="fa-solid fa-trash text-danger"></i></button>
            </td>
        </tr>
    `).join('');
    tableBody.innerHTML = html;
}

function openAdminProductDetail(id) {
    if (!id) return;
    window.location.href = `Admin-product-detail.html?id=${encodeURIComponent(id)}`;
}

function renderPagination(totalItems, currentPage, pageSize) {
    const paginationEl = document.getElementById('product-pagination');
    if (!paginationEl) return;

    const totalPages = getTotalPages(totalItems, pageSize);
    if (totalItems <= pageSize) {
        paginationEl.innerHTML = '';
        return;
    }

    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }

    const prevDisabled = currentPage <= 1 ? ' disabled' : '';
    const nextDisabled = currentPage >= totalPages ? ' disabled' : '';

    let html = `
        <li class="page-item${prevDisabled}">
            <button class="page-link" data-page="${currentPage - 1}" aria-label="Trang trước">&laquo;</button>
        </li>
    `;

    for (let page = start; page <= end; page += 1) {
        const active = page === currentPage ? ' active' : '';
        html += `
            <li class="page-item${active}">
                <button class="page-link" data-page="${page}">${page}</button>
            </li>
        `;
    }

    html += `
        <li class="page-item${nextDisabled}">
            <button class="page-link" data-page="${currentPage + 1}" aria-label="Trang sau">&raquo;</button>
        </li>
    `;

    paginationEl.innerHTML = html;

    paginationEl.querySelectorAll('button[data-page]').forEach((button) => {
        button.addEventListener('click', () => {
            const targetPage = Number(button.getAttribute('data-page'));
            if (!Number.isFinite(targetPage)) return;
            if (targetPage < 1 || targetPage > totalPages || targetPage === currentProductPage) return;

            currentProductPage = targetPage;
            renderCurrentProductPage();
        });
    });
}

function renderStats(data) {
    document.getElementById('stat-total-products').innerText = data.length;
    const totalValue = data.reduce((sum, p) => sum + (Number(p.price || 0) * Number(p.stock || 0)), 0);
    document.getElementById('stat-total-value').innerText = totalValue.toLocaleString('vi-VN') + 'đ';
    const brands = new Set(data.map(p => p.brand)).size;
    document.getElementById('stat-total-brands').innerText = brands;
}

// 3. Xử lý Thêm/Sửa/Xóa
async function deleteProduct(id) {
    if(confirm("Xóa cây vợt này khỏi hệ thống?")) {
        await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        loadProducts();
    }
}

// Hàm chuẩn bị dữ liệu cho Modal
function prepareAdd() {
    document.getElementById('modalTitle').innerText = "Thêm sản phẩm mới";
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = "";
}

async function prepareEdit(id) {
    const res = await fetch(`${API_URL}/${id}`, { headers: getAuthHeaders() });
    const p = await res.json();
    document.getElementById('modalTitle').innerText = "Chỉnh sửa sản phẩm";
    document.getElementById('productId').value = p.productId;
    document.getElementById('productName').value = getProductName(p);
    document.getElementById('brand').value = p.brand;
    document.getElementById('price').value = p.price;
    document.getElementById('stock').value = p.stock;
    document.getElementById('sku').value = p.sku || '';
    document.getElementById('weightU').value = p.weight_u || '';
    document.getElementById('gripG').value = p.grip_g || '';
    document.getElementById('tension').value = p.tension || '';
    document.getElementById('balancePoint').value = p.balance_point || '';
    document.getElementById('imageUrl').value = p.imageUrl;
    document.getElementById('description').value = p.description || '';
    
    new bootstrap.Modal(document.getElementById('productModal')).show();
}

// Gửi form (POST hoặc PUT)
document.getElementById('productForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
        const id = document.getElementById('productId').value;
        const product = {
            name: document.getElementById('productName').value.trim(),
            brand: document.getElementById('brand').value.trim(),
            price: Number(document.getElementById('price').value),
            stock: Number(document.getElementById('stock').value),
            sku: document.getElementById('sku').value.trim() || null,
            weight_u: document.getElementById('weightU').value.trim() || null,
            grip_g: document.getElementById('gripG').value.trim() || null,
            tension: document.getElementById('tension').value.trim() || null,
            balance_point: document.getElementById('balancePoint').value.trim() || null,
            imageUrl: document.getElementById('imageUrl').value.trim() || null,
            description: document.getElementById('description').value.trim() || null
        };

        if (!product.name || !product.brand) {
            alert('Tên sản phẩm và thương hiệu là bắt buộc.');
            return;
        }
        if (!Number.isFinite(product.price) || product.price < 0) {
            alert('Giá bán không hợp lệ.');
            return;
        }
        if (!Number.isFinite(product.stock) || product.stock < 0) {
            alert('Số lượng kho không hợp lệ.');
            return;
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/${id}` : API_URL;

        const response = await fetch(url, {
            method: method,
            headers: getAuthHeaders(true),
            body: JSON.stringify(product)
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || 'Không lưu được sản phẩm');
        }

        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        loadProducts();
    } catch (error) {
        console.error(error);
        alert(error.message || 'Có lỗi khi lưu sản phẩm.');
    }
};