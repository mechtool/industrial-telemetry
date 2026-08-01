#!/bin/bash
# ========================================================
# Industrial Telemetry — Yandex Cloud Production Deploy
#
# Запуск на свежей Ubuntu 22.04 VM в Yandex Cloud:
#   chmod +x deploy-yc.sh
#   ./deploy-yc.sh
# ========================================================
set -e

DOMAIN="${DOMAIN:-industrial-telemetry.ru}"
EMAIL="${EMAIL:-admin@industrial-telemetry.ru}"

echo "=== 1. Установка Docker ==="
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    sudo systemctl enable docker
fi

echo "=== 2. Клонирование репозитория ==="
if [ ! -d industrial-telemetry ]; then
    git clone https://github.com/mechtool/industrial-telemetry.git
fi
cd industrial-telemetry

echo "=== 3. Создание .env.yc ==="
cat > .env.yc << 'EOF'
# Yandex Cloud Production Environment
DOMAIN=industrial-telemetry.ru
DB_PASSWORD=kratos-production-secret
MQTT_USERNAME=server
MQTT_PASSWORD=
EOF
echo ".env.yc создан. Отредактируйте пароли: nano .env.yc"
read -p "Нажмите Enter после редактирования .env.yc..."

echo "=== 4. SSL сертификат Let's Encrypt ==="
if [ ! -d /etc/letsencrypt/live/$DOMAIN ]; then
    # Сначала получаем сертификат без nginx
    docker run --rm \
        -v /etc/letsencrypt:/etc/letsencrypt \
        -v $(pwd)/certbot-www:/var/www/certbot \
        -p 80:80 \
        certbot/certbot certonly --standalone \
        --agree-tos --email $EMAIL \
        -d $DOMAIN --non-interactive
fi

echo "=== 5. Сборка и запуск ==="
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d

echo "=== 6. Проверка ==="
sleep 10
docker compose -f docker-compose.yc.yml ps
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://$DOMAIN/

echo ""
echo "=== Готово! ==="
echo "https://$DOMAIN/"
echo ""
echo "Проверить статус:  docker compose -f docker-compose.yc.yml ps"
echo "Посмотреть логи:   docker compose -f docker-compose.yc.yml logs -f"
echo "Перезапустить:     docker compose -f docker-compose.yc.yml restart"
