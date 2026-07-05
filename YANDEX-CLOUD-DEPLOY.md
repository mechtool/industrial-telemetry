# ========================================================
# Yandex Cloud — инструкция по развёртыванию
# ========================================================
#
# Вариант A: Yandex Cloud Serverless Containers (рекомендуется)
#   1. Собрать образы:
#      docker build -t cr.yandex/<registry-id>/it-server:latest -f Dockerfile.server .
#      docker build -t cr.yandex/<registry-id>/it-client:latest -f Dockerfile.client .
#
#   2. Запушить в Container Registry:
#      docker push cr.yandex/<registry-id>/it-server:latest
#      docker push cr.yandex/<registry-id>/it-client:latest
#
#   3. Создать Serverless Container для server (порт 3000)
#   4. Создать Serverless Container для client (порт 4000)
#   5. Managed Service for MongoDB — создать кластер
#   6. Yandex IoT Core (MQTT) — или Yandex Compute Cloud с Mosquitto
#
#   Переменные окружения в Serverless Containers:
#     MONGODB_URI=mongodb://<user>:<pass>@<host>:27018/industrial-telemetry
#     MQTT_BROKER_URL=mqtt://<mqtt-host>:1883
#     CORS_ORIGIN=https://<client-subdomain>.<region>.serverless.yandexcloud.net
#
# Вариант B: Yandex Compute Cloud (виртуальная машина)
#   1. Создать ВМ с Docker
#   2. Скопировать проект и docker-compose.yml
#   3. docker compose up -d
#
# Вариант C: Yandex Managed Service for Kubernetes
#   — адаптировать docker-compose.yml в Kubernetes манифесты (deployment + service)
