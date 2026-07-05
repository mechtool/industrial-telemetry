// Инициализация MongoDB — создание коллекций и индексов
db = db.getSiblingDB('industrial-telemetry');

// Создание коллекции пользователей с уникальными индексами
db.createCollection('users');

db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

// Seed-данные: администратор по умолчанию (пароль: admin123)
db.users.insertOne({
  username: 'admin',
  email: 'admin@telemetry.local',
  passwordHash: '$2b$10$fYXchLx0lDqXjptDF66hZOerBpEd7f9pRi6Wgc3ROpMAtB7ca7tna',
  role: 'admin',
  isActive: true,
  metadata: { department: 'Engineering' },
  createdAt: new Date(),
  updatedAt: new Date(),
});

print('[MongoInit] Industrial Telemetry — инициализация завершена');
