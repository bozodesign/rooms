import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMeterReading {
  month: number;
  year: number;
  electricityReading: number;
  electricityReadingDate: Date;
  waterReading: number;
  waterReadingDate: Date;
  recordedBy?: string; // Admin who recorded
  notes?: string;
}

export interface IPaymentHistory {
  invoiceId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  totalAmount: number;
  baseRent: number;
  waterAmount: number;
  waterUnits: number;
  electricityAmount: number;
  electricityUnits: number;
  otherCharges?: number;
  paymentDate: Date;
  paymentMethod?: string;
  notes?: string;
}

export interface IUser extends Document {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  phone?: string;
  role: 'admin' | 'tenant';
  roomId?: mongoose.Types.ObjectId;
  contractStartDate?: Date;
  contractEndDate?: Date;
  depositAmount?: number; // เงินมัดจำ
  depositPaidDate?: Date;
  depositRefundDate?: Date;
  meterReadings: IMeterReading[]; // บันทึกเลขมิเตอร์
  paymentHistory: IPaymentHistory[];
  promptpayNumber?: string; // For admin - PromptPay number
  promptpayName?: string; // For admin - PromptPay account name
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MeterReadingSchema = new Schema({
  month: {
    type: Number,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  electricityReading: {
    type: Number,
    required: true,
  },
  electricityReadingDate: {
    type: Date,
    required: true,
  },
  waterReading: {
    type: Number,
    required: true,
  },
  waterReadingDate: {
    type: Date,
    required: true,
  },
  recordedBy: {
    type: String,
  },
  notes: {
    type: String,
  },
}, { _id: false });

const PaymentHistorySchema = new Schema({
  invoiceId: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
  },
  month: {
    type: Number,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  baseRent: {
    type: Number,
    required: true,
  },
  waterAmount: {
    type: Number,
    required: true,
  },
  waterUnits: {
    type: Number,
    required: true,
  },
  electricityAmount: {
    type: Number,
    required: true,
  },
  electricityUnits: {
    type: Number,
    required: true,
  },
  otherCharges: {
    type: Number,
    default: 0,
  },
  paymentDate: {
    type: Date,
    required: true,
  },
  paymentMethod: {
    type: String,
  },
  notes: {
    type: String,
  },
}, { _id: false });

const UserSchema: Schema = new Schema(
  {
    lineUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    pictureUrl: {
      type: String,
    },
    phone: {
      type: String,
    },
    role: {
      type: String,
      enum: ['admin', 'tenant'],
      default: 'tenant',
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
    },
    contractStartDate: {
      type: Date,
    },
    contractEndDate: {
      type: Date,
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    depositPaidDate: {
      type: Date,
    },
    depositRefundDate: {
      type: Date,
    },
    meterReadings: {
      type: [MeterReadingSchema],
      default: [],
    },
    paymentHistory: {
      type: [PaymentHistorySchema],
      default: [],
    },
    promptpayNumber: {
      type: String,
      trim: true,
    },
    promptpayName: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for quick lookups
UserSchema.index({ lineUserId: 1, isActive: 1 });

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
