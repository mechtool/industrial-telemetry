#!/usr/bin/env bash
# ========================================================
# Industrial Telemetry — обновление Let's Encrypt + reload nginx
#
# Запускается cron'ом на ВМ (host) дважды в сутки.
# certbot выполняется в контейнере (webroot-метод), затем nginx
# перезагружается с хоста, чтобы подхватить новый сертификат.
#
# Требования: выполнять на ВМ, где развёрнут стек
# (docker-compose.yc.yml), контейнер nginx называется it-client,
# том webroot — industrial-telemetry_certbot-webroot.
# ========================================================
set -euo pipefail

DOMAIN="industrial-telemetry.ru"
WEBROOT_VOL="industrial-telemetry_certbot-webroot"
NGINX_CONTAINER="it-client"

log() { echo "[cert-renew] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

log "start (domain=${DOMAIN})"

# 1) Обновить сертификат (webroot). certbot сам решает, пора ли обновлять.
if ! docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v "${WEBROOT_VOL}:/var/www/certbot" \
    certbot/certbot renew \
    --webroot --webroot-path=/var/www/certbot \
    --non-interactive --agree-tos --quiet; then
  log "certbot renew FAILED"
  exit 1
fi

# 2) Перезагрузить nginx, чтобы он подхватил (возможно обновлённый) сертификат.
if ! docker exec "${NGINX_CONTAINER}" nginx -s reload; then
  log "nginx reload FAILED"
  exit 1
fi

log "done"
