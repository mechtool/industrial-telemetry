import dotenv from 'dotenv';
dotenv.config();

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: environment,

  serveClient: process.env.SERVE_CLIENT === 'true' || !isProduction,

  // ---- Ory Kratos ----
  kratos: {
    publicUrl: process.env.KRATOS_PUBLIC_URL || 'http://localhost:4433',
  },

  // ---- Ory Keto (RBAC) ----
  keto: {
    readUrl: process.env.KETO_READ_URL || 'http://localhost:4466',
    writeUrl: process.env.KETO_WRITE_URL || 'http://localhost:4467',
  },

  // ---- MQTT ----
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    clientId: process.env.MQTT_CLIENT_ID || 'industrial-telemetry-server',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'industrial/',
  },

  // ---- CORS ----
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((s: string) => s.trim())
      : ['http://localhost:4200'],
  },
};
