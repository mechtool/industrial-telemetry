#!/usr/bin/env bash
# ========================================================
# Industrial Telemetry — Setup HTTPS (Let's Encrypt)
# ========================================================
# Запуск на ВМ:  bash setup-https.sh
# Требования:    домен industrial-telemetry.ru уже указывает на IP этой ВМ
#                порты 80 и 443 открыты в Security Group Yandex Cloud
# ========================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DOMAIN="industrial-telemetry.ru"
EMAIL="mit-2@yandex.ru"
COMPOSE_FILE="docker-compose.yc.yml"

echo -e "${YELLOW}=== Industrial Telemetry — Настройка HTTPS ===${NC}"
echo ""

# ── Проверка: мы в корне проекта? ──
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}Ошибка: $COMPOSE_FILE не найден. Запустите скрипт из корня проекта.${NC}"
    exit 1
fi

# ── Проверка: домен резолвится? ──
echo -n "Проверка DNS для $DOMAIN... "
HOST_IP=$(dig +short "$DOMAIN" 2>/dev/null || nslookup "$DOMAIN" 2>/dev/null | grep -E 'Address: [0-9]' | tail -1 | awk '{print $2}')
VM_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com)
if [ -z "$HOST_IP" ]; then
    echo ""
    echo -e "${RED}Ошибка: домен $DOMAIN не резолвится.${NC}"
    echo "Убедитесь, что A-запись указывает на IP этой ВМ ($VM_IP)."
    echo "Продолжить всё равно? (y/n)"
    read -r response
    [ "$response" != "y" ] && exit 1
else
    echo "$HOST_IP"
    if [ "$HOST_IP" != "$VM_IP" ] && [ -n "$VM_IP" ]; then
        echo -e "${YELLOW}⚠ A-запись ($HOST_IP) не совпадает с IP ВМ ($VM_IP).${NC}"
        echo "Проверка Let's Encrypt скорее всего не пройдёт."
        echo "Продолжить? (y/n)"
        read -r response
        [ "$response" != "y" ] && exit 1
    fi
fi

# ── Шаг 1: Самоподписанный сертификат-заглушка ──
echo ""
echo -e "${YELLOW}[1/4] Создание самоподписанного сертификата...${NC}"
mkdir -p certbot/conf/live/$DOMAIN certbot/www

openssl req -x509 -nodes -days 1 \
    -newkey rsa:2048 \
    -keyout "certbot/conf/live/$DOMAIN/privkey.pem" \
    -out "certbot/conf/live/$DOMAIN/fullchain.pem" \
    -subj "/CN=$DOMAIN" 2>/dev/null

echo -e "${GREEN}✓ Самоподписанный сертификат создан${NC}"

# ── Шаг 2: Запуск nginx ──
echo ""
echo -e "${YELLOW}[2/4] Запуск nginx...${NC}"
docker compose -f "$COMPOSE_FILE" up -d nginx
sleep 2

# Проверка, что nginx слушает порт 80
if docker compose -f "$COMPOSE_FILE" exec -T nginx wget -qO- http://localhost/.well-known/ 2>/dev/null; then
    echo -e "${GREEN}✓ Nginx запущен и слушает порт 80${NC}"
else
    echo -e "${YELLOW}⚠ Nginx запущен, но порт 80 может быть недоступен локально (это нормально)${NC}"
fi

# ── Шаг 3: Получение сертификата Let's Encrypt ──
echo ""
echo -e "${YELLOW}[3/4] Запрос сертификата Let's Encrypt...${NC}"
echo "Это может занять до 30 секунд..."

if docker compose -f "$COMPOSE_FILE" run --rm certbot \
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
    echo "  3. Nginx не запущен или не отдаёт ACME challenge"
    echo ""
    echo "Для диагностики:"
    echo "  curl -v http://$DOMAIN/.well-known/acme-challenge/test"
    echo "  docker compose -f $COMPOSE_FILE logs nginx"
    exit 1
fi

# ── Шаг 4: Перезагрузка nginx ──
echo ""
echo -e "${YELLOW}[4/4] Перезагрузка nginx с настоящим сертификатом...${NC}"
docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload
echo -e "${GREEN}✓ Nginx перезагружен${NC}"

# ── Проверка ──
echo ""
echo -e "${YELLOW}=== Проверка ===${NC}"
echo ""

echo -n "HTTP → HTTPS редирект... "
if curl -sI "http://$DOMAIN" 2>/dev/null | grep -q "301"; then
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
echo "Сертификат будет автоматически обновляться каждые 12 часов (certbot renew)."
echo "Срок действия — 90 дней, обновление — за 30 дней до истечения."
