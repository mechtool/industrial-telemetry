# ========================================================
# Запись SMTP-доступа Yandex Cloud Postbox в .env.yc
#
# Зачем: секрет API-ключа нельзя вписывать руками в URI — символы + / =
# ломают строку подключения, их нужно URL-кодировать. Скрипт делает это сам
# и не печатает секрет ни на экран, ни в историю команд.
#
# Запуск:
#   pwsh -File scripts/set-postbox-smtp.ps1
#
# Скрипт меняет только строки SMTP_URI и SMTP_URL в .env.yc,
# остальные значения не трогает.
# ========================================================

$ErrorActionPreference = 'Stop'

$envPath = Join-Path $PSScriptRoot '..\.env.yc'
$envPath = [System.IO.Path]::GetFullPath($envPath)

if (-not (Test-Path $envPath)) {
    Write-Host "Файл .env.yc не найден: $envPath" -ForegroundColor Red
    Write-Host 'Скопируйте шаблон: cp .env.yc.example .env.yc'
    exit 1
}

Write-Host 'Yandex Cloud Postbox — SMTP-доступ для .env.yc' -ForegroundColor Cyan
Write-Host ''
Write-Host 'ID ключа и секрет берутся в консоли:'
Write-Host '  Сервисные аккаунты -> ваш аккаунт -> Создать новый ключ -> API-ключ'
Write-Host '  Область действия (scope): yc.postbox.send'
Write-Host ''

$keyId = Read-Host 'ID API-ключа'
if ([string]::IsNullOrWhiteSpace($keyId)) {
    Write-Host 'ID ключа не указан — выходим.' -ForegroundColor Red
    exit 1
}

$secretSecure = Read-Host 'Секрет API-ключа (ввод скрыт)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretSecure)
try {
    $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($secret)) {
    Write-Host 'Секрет не указан — выходим.' -ForegroundColor Red
    exit 1
}

$keyId = $keyId.Trim()
$secret = $secret.Trim()
# Обязательно: + / = и прочие спецсимволы в секрете ломают URI.
$secretEncoded = [uri]::EscapeDataString($secret)

$smtpUri = "smtps://${keyId}:${secretEncoded}@postbox.cloud.yandex.net:465/?skip_ssl_verify=false"
$smtpUrl = "smtps://${keyId}:${secretEncoded}@postbox.cloud.yandex.net:465"

$content = [System.IO.File]::ReadAllText($envPath)
if (-not $content.Contains("`n")) {
    $content = $content.Replace("`r", "`n")
}
$lines = $content -split "`n"

$seenUri = $false
$seenUrl = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '^\s*SMTP_URI\s*=') {
        $lines[$i] = "SMTP_URI=$smtpUri"
        $seenUri = $true
    }
    elseif ($lines[$i] -match '^\s*SMTP_URL\s*=') {
        $lines[$i] = "SMTP_URL=$smtpUrl"
        $seenUrl = $true
    }
}

$result = ($lines -join "`n")
if (-not $seenUri) {
    $result += "`nSMTP_URI=$smtpUri`n"
}
if (-not $seenUrl) {
    $result += "SMTP_URL=$smtpUrl`n"
}

[System.IO.File]::WriteAllText($envPath, $result, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ''
Write-Host 'Готово. Записано в .env.yc:' -ForegroundColor Green
Write-Host ("  SMTP_URI=smtps://{0}:***@postbox.cloud.yandex.net:465/?skip_ssl_verify=false" -f $keyId)
Write-Host ("  SMTP_URL=smtps://{0}:***@postbox.cloud.yandex.net:465" -f $keyId)
Write-Host ''
Write-Host 'Проверка отправки следующая: запустить тест из проекта.'
