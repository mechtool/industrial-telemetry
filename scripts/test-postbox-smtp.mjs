// ========================================================
// Проверка отправки через Yandex Cloud Postbox.
//
// Читает SMTP_URL / MAIL_FROM из .env.yc, проверяет подключение и авторизацию,
// затем отправляет письмо на адрес симулятора доставки Postbox — реальным
// получателям ничего не уходит.
//
// Запуск (из корня проекта):
//   node scripts/test-postbox-smtp.mjs
//   node scripts/test-postbox-smtp.mjs you@example.com   — на свой адрес
//
// Секреты не печатаются: в выводе только хост, логин и результат.
// ========================================================

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nodemailer = require('../server/node_modules/nodemailer');

const SIMULATOR = 'success@simulator.pstbx.ru';

function readEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) {
    return env;
  }
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function transportOptions(smtpUrl, rejectUnauthorized) {
  const url = new URL(smtpUrl);
  const secure = url.protocol === 'smtps:' || url.port === '465';
  return {
    host: url.hostname,
    port: Number(url.port || (secure ? 465 : 587)),
    secure,
    auth: {
      user: decodeURIComponent(url.username),
      pass: decodeURIComponent(url.password),
    },
    tls: { rejectUnauthorized },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  };
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.yc');
  const env = readEnvFile(envPath);
  const smtpUrl = env.SMTP_URL;

  if (!smtpUrl) {
    console.error(`SMTP_URL не задан в ${envPath}. Сначала запустите scripts/set-postbox-smtp.ps1`);
    process.exit(1);
  }

  const from = env.MAIL_FROM || 'noreply@industrial-telemetry.ru';
  const to = process.argv[2] || SIMULATOR;
  const rejectUnauthorized = (env.SMTP_REJECT_UNAUTHORIZED || 'true') !== 'false';

  const options = transportOptions(smtpUrl, rejectUnauthorized);
  console.log('Проверка Postbox');
  console.log(`  Хост:       ${options.host}:${options.port} (${options.secure ? 'SMTPS' : 'STARTTLS'})`);
  console.log(`  Логин:      ${options.auth.user}`);
  console.log(`  Отправитель:${from}`);
  console.log(`  Получатель: ${to}\n`);

  const transport = nodemailer.createTransport(options);

  try {
    await transport.verify();
    console.log('  [1/2] Подключение и авторизация: OK');
  } catch (err) {
    console.error(`  [1/2] Подключение не удалось: ${err.message}`);
    process.exit(1);
  }

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject: 'Проверка отправки из Industrial Telemetry',
      text: 'Тестовое письмо. Если вы его видите — SMTP настроен и домен подтверждён.',
      html: '<p>Тестовое письмо.</p><p>Если вы его видите — SMTP настроен и домен подтверждён.</p>',
    });
    console.log(`  [2/2] Письмо принято сервером: OK`);
    console.log(`        id: ${info.messageId}`);
    console.log(`        ответ сервера: ${(info.response || '').split('\n')[0]}`);
  } catch (err) {
    console.error(`  [2/2] Отправка не удалась: ${err.message}`);
    process.exit(1);
  }

  console.log('\nГотово.');
}

main();
