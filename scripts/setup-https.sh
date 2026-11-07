#!/usr/bin/env bash
# ========================================================
# Industrial Telemetry — Setup HTTPS (Let's Encrypt)
# ========================================================
# Запуск на ВМ (пользователь с sudo):  bash scripts/setup-https.sh
# Требования: домен industrial-telemetry.ru указывает на IP этой ВМ,
#             порты 80/443 открыты в Security Group Yandex Cloud,
#             в корне проекта уже лежит .env.yc.
#
# Метод: webroot (совпадает с scripts/renew-cert.sh). nginx (сервис
# `client`) поднимается с самоподписанным сертификатом-заглушкой, затем
# certbot выпускает настоящий сертификат через ACME-челлендж и nginx
# перезагружается.
# ========================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="industrial-telemetry.ru"
EMAIL="mit-2@yandex.ru"
COMPOSE_FILE="docker-compose.yc.yml"
ENV_FILE=".env.yc"
LETSENCRYPT="/etc/letsencrypt"
REPO_DIR="$(pwd)"

echo -e "${YELLOW}=== Industrial Telemetry — Настройка HTTPS ===${NC}"
echo ""

# ── Проверка: корень проекта и .env.yc ──
if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${RED}Ошибка: $COMPOSE_FILE не найден. Запустите из корня проекта.${NC}"
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Ошибка: $ENV_FILE не найден. Сначала создайте его из .env.yc.example.${NC}"
  exit 1
fi

# ── Проверка DNS ──
echo -n "Проверка DNS для $DOMAIN... "
HOST_IP=$(dig +short "$DOMAIN" 2>/dev/null || nslookup "$DOMAIN" 2>/dev/null | grep -E 'Address: [0-9]' | tail -1 | awk '{print $2}')
VM_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com)
if [ -z "$HOST_IP" ]; then
  echo ""
  echo -e "${RED}Ошибка: домен $DOMAIN не резолвится.${NC}"
  echo "Убедитесь, что A-запись указывает на IP этой ВМ ($VM_IP)."
  read -r -p "Продолжить всё равно? (y/n) " response
  [ "$response" != "y" ] && exit 1
else
  echo "$HOST_IP"
  if [ "$HOST_IP" != "$VM_IP" ] && [ -n "$VM_IP" ]; then
    echo -e "${YELLOW}⚠ A-запись ($HOST_IP) не совпадает с IP ВМ ($VM_IP).${NC}"
    read -r -p "Продолжить? (y/n) " response
    [ "$response" != "y" ] && exit 1
  fi
fi

# ── Шаг 1: самоподписанный сертификат-заглушка ──
echo ""
echo -e "${YELLOW}[1/4] Создание самоподписанного сертификата...${NC}"
sudo mkdir -p "$LETSENCRYPT/live/$DOMAIN"
sudo openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
  -keyout "$LETSENCRYPT/live/$DOMAIN/privkey.pem" \
  -out "$LETSENCRYPT/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=$DOMAIN" 2>/dev/null
echo -e "${GREEN}✓ Заглушка создана${NC}"

# ── Шаг 2: поднять nginx (сервис client) ──
echo ""
echo -e "${YELLOW}[2/4] Запуск nginx (сервис client)...${NC}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d client
sleep 2
echo -e "${GREEN}✓ nginx запущен${NC}"

# ── Шаг 3: выпустить настоящий сертификат (webroot) ──
echo ""
echo -e "${YELLOW}[3/4] Запрос сертификата Let's Encrypt (webroot)...${NC}"

# Убираем заглушку, чтобы certbot создал свои symlink'и в live/$DOMAIN.
# nginx продолжает работать — файлы сертификата уже загружены в память.
sudo rm -f "$LETSENCRYPT/live/$DOMAIN/fullchain.pem" "$LETSENCRYPT/live/$DOMAIN/privkey.pem"

if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm certbot \
    certonly --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" --agree-tos --non-interactive; then
  echo -e "${GREEN}✓ Сертификат Let's Encrypt получен${NC}"
else
  echo ""
  echo -e "${RED}Ошибка: не удалось получить сертификат.${NC}"
  echo ""
  echo "Возможные причины:"
  echo "  1. Домен не указывает на IP этой ВМ"
  echo "  2. Порт 80 закрыт в Security Group Yandex Cloud"
  echo "  3. nginx не отдаёт ACME-challenge из volume certbot-webroot"
  echo ""
  echo "Диагностика:"
  echo "  curl -v http://$DOMAIN/.well-known/acme-challenge/test"
  echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs client"
  exit 1
fi

# ── Шаг 4: перезагрузить nginx с настоящим сертификатом ──
echo ""
echo -e "${YELLOW}[4/4] Перезагрузка nginx...${NC}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T client nginx -s reload
echo -e "${GREEN}✓ nginx перезагружен${NC}"

# ── Проверка ──
echo ""
echo -e "${YELLOW}=== Проверка ===${NC}"
echo ""

echo -n "HTTP → HTTPS редирект... "
if curl -sI "http://$DOMAIN" 2>/dev/null | grep -qi "301\|302"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
fi

echo -n "HTTPS ответ... "
if curl -sI "https://$DOMAIN" 2>/dev/null | grep -q "HTTP/2"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
fi

echo -n "Сертификат... "
ISSUER=$(curl -svI "https://$DOMAIN" 2>&1 | grep "issuer:" | head -1)
if echo "$ISSUER" | grep -q "Let's Encrypt"; then
  echo -e "${GREEN}✓ $ISSUER${NC}"
else
  echo -e "${YELLOW}⚠ $ISSUER${NC}"
fi

echo ""
echo -e "${GREEN}=== Готово! Сайт доступен по https://$DOMAIN ===${NC}"
echo ""
echo "Настройте автообновление cron-задачей на ВМ:"
echo "  0 3,15 * * * $REPO_DIR/scripts/renew-cert.sh >> $REPO_DIR/renew-cert.log 2>&1"
echo "Срок действия сертификата — 90 дней, обновление — за 30 дней до истечения."
