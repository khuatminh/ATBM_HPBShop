(() => {
  const API_BASE = "http://localhost:8080";

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");
  const userId = Number(user?.userId ?? user?.id ?? 0);

  const purchaseListEl = document.getElementById("purchase-list");
  const tabsEl = document.getElementById("order-status-tabs");
  const searchInputEl = document.getElementById("order-search-input");
  const sidebarUsernameEl = document.getElementById("sidebar-username");

  let orders = [];
  let activeStatus = "all";

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function toVnd(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " đ";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function mapStatus(status) {
    const raw = String(status || "").toLowerCase();

    if (raw.includes("cancel")) {
      return { key: "cancelled", label: "Đã hủy", className: "text-danger", icon: "fa-circle-xmark" };
    }
    if (raw.includes("complete") || raw.includes("done") || raw.includes("success")) {
      return { key: "completed", label: "Hoàn thành", className: "text-success", icon: "fa-circle-check" };
    }
    if (raw.includes("ship") || raw.includes("deliver") || raw.includes("transit")) {
      return { key: "shipping", label: "Đang giao", className: "text-primary", icon: "fa-truck" };
    }
    return { key: "pending", label: "Chờ thanh toán", className: "text-warning", icon: "fa-hourglass-half" };
  }

  function orderMatches(order, keyword) {
    if (!keyword) {
      return true;
    }

    const q = keyword.toLowerCase();
    const code = String(order.id || "");
    const hasOrderCode = code.toLowerCase().includes(q);
    const hasProductName = (order.items || []).some((item) => String(item.productName || "").toLowerCase().includes(q));

    return hasOrderCode || hasProductName;
  }

  function normalizeItems(order) {
    if (Array.isArray(order.items) && order.items.length) {
      return order.items;
    }
    return [];
  }

  function normalizeApiOrders(rawOrders) {
    if (!Array.isArray(rawOrders)) {
      return [];
    }

    return rawOrders
      .map((order) => {
        const normalizedItems = (Array.isArray(order?.orderItems) ? order.orderItems : order?.items || [])
          .map((item) => {
            const productName = item?.product?.name || item?.productName || "Sản phẩm";
            const quantity = toNumber(item?.quantity);
            const price = item?.priceAtPurchase ?? item?.price ?? item?.product?.price ?? 0;

            return {
              productName,
              quantity,
              price
            };
          })
          .filter((item) => item.quantity > 0);

        return {
          id: toNumber(order?.orderId ?? order?.id),
          status: order?.status || "pending",
          totalAmount: order?.totalPrice ?? order?.totalAmount ?? 0,
          items: normalizedItems
        };
      })
      .filter((order) => order.id > 0);
  }

  function renderOrderCard(order) {
    const status = mapStatus(order.status);
    const items = normalizeItems(order);

    const itemsHtml = items
      .map((item) => {
        return `
          <div class="d-flex align-items-center py-2 border-bottom">
            <div class="flex-grow-1">
              <h6 class="mb-1 small fw-bold">${escapeHtml(item.productName || "Sản phẩm")}</h6>
              <span class="small">Số lượng: x${Number(item.quantity || 0)}</span>
            </div>
            <div class="text-end ms-3">
              <span class="text-primary fw-bold d-block">${toVnd(item.price || 0)}</span>
            </div>
          </div>
        `;
      })
      .join("");

    const canCancel = status.key === "pending";

    return `
      <div class="card border-0 shadow-sm mb-3" data-order-id="${Number(order.id || 0)}">
        <div class="card-header bg-white d-flex justify-content-between align-items-center py-3">
          <div class="fw-bold small">Đơn hàng #${Number(order.id || 0)}</div>
          <div class="d-flex align-items-center">
            <span class="${status.className} small text-uppercase"><i class="fa-solid ${status.icon} me-1"></i> ${status.label}</span>
          </div>
        </div>
        <div class="card-body py-2">
          ${itemsHtml || '<div class="text-secondary small">Không có sản phẩm.</div>'}
        </div>
        <div class="card-footer bg-white text-end py-3">
          <div class="mb-2">
            <span class="small text-secondary me-2">Thành tiền:</span>
            <span class="fw-bold text-primary">${toVnd(order.totalAmount || 0)}</span>
          </div>
          <div class="d-flex justify-content-end gap-2">
            ${canCancel ? `<button class="btn btn-outline-danger btn-sm btn-cancel-order" data-order-id="${Number(order.id || 0)}">Hủy đơn</button>` : ""}
            <button class="btn btn-primary btn-sm btn-reorder" data-order-id="${Number(order.id || 0)}">Mua lại</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderOrders() {
    if (!purchaseListEl) {
      return;
    }

    const keyword = (searchInputEl?.value || "").trim();
    const filtered = orders.filter((order) => {
      const status = mapStatus(order.status).key;
      const matchStatus = activeStatus === "all" || status === activeStatus;
      return matchStatus && orderMatches(order, keyword);
    });

    if (!orders.length && activeStatus === "all" && !keyword) {
      purchaseListEl.innerHTML = "";
      return;
    }

    if (!filtered.length) {
      purchaseListEl.innerHTML = `
        <div class="card border-0 shadow-sm mb-3">
          <div class="card-body text-center text-secondary small">Không có đơn hàng phù hợp.</div>
        </div>
      `;
      return;
    }

    purchaseListEl.innerHTML = filtered.map(renderOrderCard).join("");
  }

  function bindTabEvents() {
    if (!tabsEl) {
      return;
    }

    tabsEl.querySelectorAll(".nav-link").forEach((tab) => {
      tab.addEventListener("click", (event) => {
        event.preventDefault();

        tabsEl.querySelectorAll(".nav-link").forEach((node) => node.classList.remove("active"));
        tab.classList.add("active");

        activeStatus = tab.dataset.status || "all";
        renderOrders();
      });
    });
  }

  async function cancelOrder(orderId) {
    if (!token || !userId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/customer/orders/cancel/${orderId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Hủy đơn thất bại");
      }

      orders = orders.map((order) => {
        if (Number(order.id) === Number(orderId)) {
          return { ...order, status: "cancelled" };
        }
        return order;
      });
      renderOrders();
      alert("Đã hủy đơn hàng.");
    } catch (error) {
      alert(error.message || "Không thể hủy đơn lúc này.");
    }
  }

  async function reorder(orderId) {
    if (!token || !userId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/customer/orders/reorder/${orderId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Mua lại thất bại");
      }

      alert("Đã thêm lại sản phẩm vào giỏ hàng.");
      window.location.href = "Gio-hang.html";
    } catch (error) {
      alert(error.message || "Không thể mua lại lúc này.");
    }
  }

  function bindListEvents() {
    if (!purchaseListEl) {
      return;
    }

    purchaseListEl.addEventListener("click", (event) => {
      const cancelBtn = event.target.closest(".btn-cancel-order");
      if (cancelBtn) {
        const orderId = Number(cancelBtn.dataset.orderId || 0);
        if (!orderId) {
          return;
        }
        if (window.confirm("Bạn có chắc muốn hủy đơn này không?")) {
          cancelOrder(orderId);
        }
        return;
      }

      const reorderBtn = event.target.closest(".btn-reorder");
      if (reorderBtn) {
        const orderId = Number(reorderBtn.dataset.orderId || 0);
        if (!orderId) {
          return;
        }
        reorder(orderId);
      }
    });
  }

  async function loadOrders() {
    if (!token || !userId) {
      alert("Vui lòng đăng nhập để xem đơn mua.");
      window.location.href = "Dang-nhap.html";
      return;
    }

    if (sidebarUsernameEl) {
      sidebarUsernameEl.textContent = user.username || user.fullname || user.fullName || "Khách hàng";
    }

    try {
      const response = await fetch(`${API_BASE}/api/customer/orders/my-orders/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Không thể tải danh sách đơn mua.");
      }

      const data = await response.json();
      orders = normalizeApiOrders(data);
      renderOrders();
    } catch (error) {
      purchaseListEl.innerHTML = `
        <div class="card border-0 shadow-sm mb-3">
          <div class="card-body text-center text-danger small">${escapeHtml(error.message || "Đã có lỗi xảy ra khi tải đơn mua.")}</div>
        </div>
      `;
    }
  }

  function bindSearch() {
    if (!searchInputEl) {
      return;
    }

    searchInputEl.addEventListener("input", renderOrders);
  }

  bindTabEvents();
  bindSearch();
  bindListEvents();
  loadOrders();
})();
