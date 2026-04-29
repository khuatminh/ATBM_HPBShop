(function () {
    function getUser() {
        const rawUser = localStorage.getItem('user');
        if (!rawUser) return null;
        try {
            return JSON.parse(rawUser);
        } catch (error) {
            return null;
        }
    }

    function getToken() {
        return localStorage.getItem('token');
    }

    function clearSession() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    }

    function logout(redirectTo) {
        clearSession();
        window.location.href = redirectTo || 'Dang-nhap.html';
    }

    function authHeaders(withJson) {
        const headers = {
            Authorization: `Bearer ${getToken() || ''}`
        };
        if (withJson) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    }

    function requireAdmin() {
        const user = getUser();
        const token = getToken();

        if (!user || !token) {
            window.location.href = 'Dang-nhap.html';
            return null;
        }

        if (user.role !== 'admin') {
            window.location.href = 'Trang-chu.html';
            return null;
        }

        return user;
    }

    function applyAdminName(user) {
        const adminNameNode = document.querySelector('.admin-name');
        if (adminNameNode && user && user.fullname) {
            adminNameNode.innerText = user.fullname;
        }
    }

    function bindLogoutLinks() {
        document.querySelectorAll('.admin-logout').forEach((link) => {
            if (link.dataset.bound === '1') return;
            link.dataset.bound = '1';
            link.addEventListener('click', (event) => {
                event.preventDefault();
                logout('Dang-nhap.html');
            });
        });
    }

    window.AdminAuth = {
        getUser,
        getToken,
        clearSession,
        logout,
        authHeaders,
        requireAdmin,
        applyAdminName,
        bindLogoutLinks
    };

    document.addEventListener('DOMContentLoaded', bindLogoutLinks);
})();
