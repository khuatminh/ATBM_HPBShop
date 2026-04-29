#!/usr/bin/env bash
# Seed thêm user cho demo SQLi. Idempotent — chạy lại không bị duplicate.
# Yêu cầu: backend chạy ở localhost:8080, MySQL chạy ở localhost:3306.

set -e
API="http://localhost:8080/api/auth/register"
MYSQL_PWD=minhkhuat123

echo "=== Đăng ký 4 user mới qua API (BCrypt hash) ==="
curl -s -X POST "$API" -H "Content-Type: application/json" \
  -d '{"username":"manager","fullname":"Quan Ly Kho","email":"manager@hpb.com","password":"manager123","phone":"0900000003","gender":"male"}' \
  | head -c 200; echo
curl -s -X POST "$API" -H "Content-Type: application/json" \
  -d '{"username":"staff01","fullname":"Nhan Vien 01","email":"staff01@hpb.com","password":"staff123","phone":"0900000004","gender":"male"}' \
  | head -c 200; echo
curl -s -X POST "$API" -H "Content-Type: application/json" \
  -d '{"username":"vipuser","fullname":"VIP Customer","email":"vip@hpb.com","password":"vippass","phone":"0900000005","gender":"female"}' \
  | head -c 200; echo
curl -s -X POST "$API" -H "Content-Type: application/json" \
  -d '{"username":"locked01","fullname":"Locked Acc","email":"locked@hpb.com","password":"abc123","phone":"0900000006","gender":"male"}' \
  | head -c 200; echo

echo ""
echo "=== Cập nhật role/status sau khi đăng ký ==="
/usr/local/mysql/bin/mysql -u root -p"$MYSQL_PWD" HPBSports_DB <<SQL
UPDATE users SET role='admin' WHERE username='manager';
UPDATE users SET status='locked' WHERE username='locked01';
SELECT user_id, username, role, status FROM users ORDER BY user_id;
SQL
