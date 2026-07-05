import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  role: 'operator' | 'engineer' | 'admin';
  isActive: boolean;
  lastLogin?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Имя пользователя обязательно'],
      unique: true,
      trim: true,
      minlength: [3, 'Минимум 3 символа'],
      maxlength: [64, 'Максимум 64 символа'],
    },
    email: {
      type: String,
      required: [true, 'Email обязателен'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Некорректный формат email'],
    },
    role: {
      type: String,
      enum: {
        values: ['operator', 'engineer', 'admin'],
        message: 'Роль должна быть operator, engineer или admin',
      },
      default: 'operator',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        ret.id = ret._id.toString();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        delete (ret as Record<string, unknown>)._id;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

// Индекс для быстрого поиска по email
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
