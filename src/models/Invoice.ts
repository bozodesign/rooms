import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

export interface IInvoice extends Document {
  roomId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  month: number; // 1-12
  year: number;

  // Utility readings
  waterUnits: number;
  electricityUnits: number;
  previousWaterReading?: number;
  previousElectricityReading?: number;
  currentWaterReading?: number;
  currentElectricityReading?: number;

  // Charges
  rentAmount: number;
  waterAmount: number;
  electricityAmount: number;
  otherCharges?: number;
  otherChargesDescription?: string;
  discount?: number;
  totalAmount: number;

  // Payment details
  paymentStatus: PaymentStatus;
  dueDate: Date;
  paidAt?: Date;
  paymentMethod?: 'promptpay' | 'cash' | 'transfer';
  paymentSlipUrl?: string;
  paymentNote?: string;

  // Admin tracking
  generatedBy?: mongoose.Types.ObjectId;
  verifiedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema: Schema = new Schema(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },

    // Utility readings
    waterUnits: {
      type: Number,
      required: true,
      min: 0,
    },
    electricityUnits: {
      type: Number,
      required: true,
      min: 0,
    },
    previousWaterReading: {
      type: Number,
      min: 0,
    },
    previousElectricityReading: {
      type: Number,
      min: 0,
    },
    currentWaterReading: {
      type: Number,
      min: 0,
    },
    currentElectricityReading: {
      type: Number,
      min: 0,
    },

    // Charges
    rentAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    waterAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    electricityAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    otherCharges: {
      type: Number,
      default: 0,
    },
    otherChargesDescription: {
      type: String,
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Payment details
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
    },
    paymentMethod: {
      type: String,
      enum: ['promptpay', 'cash', 'transfer'],
    },
    paymentSlipUrl: {
      type: String,
    },
    paymentNote: {
      type: String,
    },

    // Admin tracking
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique invoice per room per month/year
InvoiceSchema.index({ roomId: 1, month: 1, year: 1 }, { unique: true });
InvoiceSchema.index({ tenantId: 1, paymentStatus: 1 });
InvoiceSchema.index({ paymentStatus: 1, dueDate: 1 });

const Invoice: Model<IInvoice> = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);

export default Invoice;
