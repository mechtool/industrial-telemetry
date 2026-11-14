#!/bin/bash
# ========================================================
# Industrial Telemetry — Yandex Cloud Production Deploy
#
# Запуск на свежей Ubuntu 22.04/24.04 VM в Yandex Cloud:
#   chmod +x deploy-yc.sh
#   ./deploy-yc.sh
# ========================================================
set -e

DOMAIN="${DOMAIN:-industrial-telemetry.ru}"
EMAIL="${EMAIL:-admin@industrial-telemetry.ru}"
REPO_URL="${REPO_URL:-https://github.com/mechtool/industrial-telemetry.git}"

echo "=== 1. Установка Docker ==="
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    sudo systemctl enable docker
fi

echo "=== 2. Клонирование репозитория ==="
if [ ! -d industrial-telemetry ]; then
    git clone "$REPO_URL"
fi
cd industrial-telemetry

echo "=== 3. Создание .env.yc ==="
if [ ! -f .env.yc ]; then
    cat > .env.yc << 'EOF'
# Yandex Cloud Production Environment
DOMAIN=industrial-telemetry.ru
DB_PASSWORD=kratos-production-secret
MQTT_USERNAME=server
MQTT_PASSWORD=
# WEBHOOK_SECRET — общий секрет webhook Kratos -> server
# (должен совпадать с web_hook.auth.config.value в kratos/kratos.yc.yml)
WEBHOOK_SECRET=
# DaData API-ключ (подсказки адресов РФ)
DADATA_API_KEY=
# SMTP для Kratos — письма восстановления пароля
# (пример: smtps://noreply%40industrial-telemetry.ru:<пароль-приложения>@smtp.yandex.ru:465/?skip_ssl_verify=false)
SMTP_URI=
# SMTP для сервера — письма подтверждения регистрации (nodemailer).
# Без SMTP_URL письма подтверждения не уходят (сервер логирует предупреждение).
SMTP_URL=
SMTP_REJECT_UNAUTHORIZED=true
MAIL_FROM=noreply@industrial-telemetry.ru
# Адрес, из которого строится ссылка подтверждения в письме.
APP_BASE_URL=https://industrial-telemetry.ru
EOF
    echo ".env.yc создан. Отредактируйте секреты: nano .env.yc"
fi
read -r -p "Нажмите Enter после редактирования .env.yc..."

echo "=== 4. Создание kratos/kratos.yc.yml ==="
if [ ! -f kratos/kratos.yc.yml ]; then
    cp kratos/kratos.yc.example.yml kratos/kratos.yc.yml
    COOKIE=$(openssl rand -hex 16)
    CIPHER=$(openssl rand -hex 16)
    sed -i "s/change-me-cookie-secret-00000000/$COOKIE/; s/change-me-cipher-secret-00000000/$CIPHER/" kratos/kratos.yc.yml
    echo "kratos/kratos.yc.yml создан (secrets.cookie/cipher сгенерированы)."
    echo "ВНИМАНИЕ: замените web_hook.auth.config.value (change-me-webhook-secret)"
    echo "на то же значение, что и WEBHOOK_SECRET в .env.yc: nano kratos/kratos.yc.yml"
fi
read -r -p "Нажмите Enter после проверки kratos/kratos.yc.yml..."

echo "=== 5. SSL-сертификат Let's Encrypt (webroot) ==="
bash scripts/setup-https.sh

echo "=== 6. Сборка и запуск ==="
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d

echo "=== 7. Автообновление сертификатов (cron) ==="
if ! command -v crontab &>/dev/null; then
    sudo apt-get update -y && sudo apt-get install -y cron
fi
CRON_LINE="0 3,15 * * * $(pwd)/scripts/renew-cert.sh >> $(pwd)/renew-cert.log 2>&1"
if ! crontab -l 2>/dev/null | grep -qF "renew-cert.sh"; then
    ( crontab -l 2>/dev/null; echo "$CRON_LINE" ) | crontab -
    echo "Добавлена cron-задача: $CRON_LINE"
else
    echo "cron-задача renew-cert.sh уже есть."
fi

echo "=== 8. Проверка ==="
sleep 10
docker compose -f docker-compose.yc.yml --env-file .env.yc ps
curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://$DOMAIN/"

echo ""
echo "=== Готово! ==="
echo "https://$DOMAIN/"
echo ""
echo "Проверить статус:  docker compose -f docker-compose.yc.yml --env-file .env.yc ps"
echo "Посмотреть логи:   docker compose -f docker-compose.yc.yml --env-file .env.yc logs -f"
echo "Перезапустить:     docker compose -f docker-compose.yc.yml --env-file .env.yc restart"
