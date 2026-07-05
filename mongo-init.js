// Инициализация MongoDB — создание коллекций и индексов
db = db.getSiblingDB('industrial-telemetry');

// Создание коллекции пользователей с уникальными индексами
db.createCollection('users');

db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

// Seed-данные: администратор по умолчанию
db.users.insertOne({
  username: 'admin',
  email: 'admin@telemetry.local',
  role: 'admin',
  isActive: true,
  metadata: { department: 'Engineering' },
  createdAt: new Date(),
  updatedAt: new Date(),
});

print('[MongoInit] Industrial Telemetry — инициализация завершена');
