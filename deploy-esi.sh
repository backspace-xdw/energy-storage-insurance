#!/usr/bin/env bash
# 一键部署储能保险平台到 :50000/esi/
# 用法：sudo bash deploy-esi.sh

set -euo pipefail

CONF=/etc/nginx/sites-available/xdwttxsp
NEW_CONF=/tmp/xdwttxsp-with-esi.conf
BACKUP=/etc/nginx/sites-available/xdwttxsp.bak.$(date +%Y%m%d-%H%M%S)
DIST=/home/shenzheng/XDW/energy-storage-insurance/dist

if [[ $EUID -ne 0 ]]; then
  echo "✗ 必须用 sudo 运行：sudo bash $0"
  exit 1
fi

[[ -f "$NEW_CONF" ]]    || { echo "✗ 配置文件不存在：$NEW_CONF"; exit 1; }
[[ -d "$DIST" ]]        || { echo "✗ 构建产物不存在：$DIST（先 cd 项目目录跑 npm run build）"; exit 1; }
[[ -f "$DIST/index.html" ]] || { echo "✗ $DIST/index.html 缺失"; exit 1; }

echo "→ 备份当前配置到 $BACKUP"
cp -a "$CONF" "$BACKUP"

echo "→ 写入新配置"
cp -a "$NEW_CONF" "$CONF"

echo "→ nginx -t 测试"
if ! nginx -t; then
  echo "✗ 配置测试失败，回滚"
  cp -a "$BACKUP" "$CONF"
  nginx -t
  exit 1
fi

echo "→ reload nginx"
nginx -s reload

echo "→ 验证 :50000/esi/"
sleep 1
HTTP=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:50000/esi/)
echo "   HTTP $HTTP"
if [[ "$HTTP" != "200" ]]; then
  echo "✗ /esi/ 返回 $HTTP（不是 200），但 nginx 已 reload。请手动检查。"
  exit 1
fi

echo "→ 验证 LFWLW 主站未受影响"
HTTP2=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:50000/)
echo "   HTTP $HTTP2"
[[ "$HTTP2" == "200" ]] || { echo "⚠ LFWLW 主站返回 $HTTP2，请检查"; exit 1; }

echo ""
echo "✓ 部署完成。访问入口："
echo "   http://ljinvestment.diskstation.me:50000/esi/"
echo "   （本机：http://localhost:50000/esi/）"
echo ""
echo "如需回滚：sudo cp $BACKUP $CONF && sudo nginx -s reload"
