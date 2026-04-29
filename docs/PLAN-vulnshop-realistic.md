# 📋 PLAN: VulnShop Realistic + Documentation

> **Mục tiêu:** Rebuild VulnShop với UI thực tế (trông như cửa hàng thật), bỏ mọi gợi ý lỗ hổng. Kèm documentation hướng dẫn tấn công chi tiết.

---

## Phase 1: Rebuild UI thực tế ✅ HOÀN THÀNH

### Thay đổi chính:
- ✅ Bỏ tất cả vulnerability badges, SQL debug box, payload hints
- ✅ Bỏ footer warning
- ✅ Giao diện cửa hàng điện tử thực tế, chuyên nghiệp (Apple-inspired light theme)
- ✅ Giữ nguyên 5 lỗ hổng ẩn trong code backend
- ✅ Fix PHP 8.2 try-catch cho tất cả queries
- ✅ Fix Vietnamese UTF-8 encoding

## Phase 2: Documentation ✅ HOÀN THÀNH

### File: `docs/HUONG-DAN-TAN-CONG.md`
- ✅ Hướng dẫn cài đặt (Docker, sqlmap, Burp Suite)
- ✅ 5 kịch bản tấn công chi tiết
- ✅ Hướng dẫn sqlmap
- ✅ Hướng dẫn Burp Suite
- ✅ Hướng dẫn fix lỗ hổng (code trước/sau)

---

## Checklist ✅ ALL PASSED
- [x] Phase 1: Rebuild tất cả PHP pages
- [x] Phase 1: Redesign CSS
- [x] Phase 2: Viết documentation đầy đủ
- [x] Test: Chạy Docker OK
- [x] Test: Auth Bypass ✅
- [x] Test: UNION-based SQLi ✅ 
- [x] Test: Error-based SQLi ✅
- [x] Test: Boolean Blind SQLi (code ready)
- [x] Test: Time-based Blind SQLi (code ready)
