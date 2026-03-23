import mongoose, { Schema, Document, Model } from 'mongoose';

export type GeneratedInvoiceType = 'invoice' | 'receipt' | 'deposit_receipt' | 'quotation';

export interface ILineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export interface IGeneratedInvoiceData {
  // Header
  logo: string | null;
  invoiceTitle: string;
  // From
  fromName: string;
  fromAddress: string;
  fromPhone: string;
  fromEmail: string;
  fromTaxId: string;
  // To
  toName: string;
  toAddress: string;
  toPhone: string;
  toEmail: string;
  toTaxId: string;
  // Invoice details
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  // Items
  items: ILineItem[];
  // Labels
  itemLabel: string;
  quantityLabel: string;
  rateLabel: string;
  amountLabel: string;
  // Calculations
  currency: string;
  taxRate: number;
  taxType: 'percent' | 'flat';
  discountRate: number;
  discountType: 'percent' | 'flat';
  shipping: number;
  // Notes
  notes: string;
  terms: string;
}

export interface IGeneratedInvoice extends Document {
  name: string;
  type: GeneratedInvoiceType;
  data: IGeneratedInvoiceData;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema({
  id: { type: String, required: true },
  description: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  rate: { type: Number, default: 0 },
}, { _id: false });

const GeneratedInvoiceDataSchema = new Schema({
  // Header
  logo: { type: String, default: null },
  invoiceTitle: { type: String, default: 'ใบแจ้งหนี้' },
  // From
  fromName: { type: String, default: '' },
  fromAddress: { type: String, default: '' },
  fromPhone: { type: String, default: '' },
  fromEmail: { type: String, default: '' },
  fromTaxId: { type: String, default: '' },
  // To
  toName: { type: String, default: '' },
  toAddress: { type: String, default: '' },
  toPhone: { type: String, default: '' },
  toEmail: { type: String, default: '' },
  toTaxId: { type: String, default: '' },
  // Invoice details
  invoiceNumber: { type: String, default: '' },
  invoiceDate: { type: String, default: '' },
  dueDate: { type: String, default: '' },
  paymentTerms: { type: String, default: '' },
  // Items
  items: { type: [LineItemSchema], default: [] },
  // Labels
  itemLabel: { type: String, default: 'รายการ' },
  quantityLabel: { type: String, default: 'จำนวน' },
  rateLabel: { type: String, default: 'ราคา/หน่วย' },
  amountLabel: { type: String, default: 'จำนวนเงิน' },
  // Calculations
  currency: { type: String, default: '฿' },
  taxRate: { type: Number, default: 0 },
  taxType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
  discountRate: { type: Number, default: 0 },
  discountType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
  shipping: { type: Number, default: 0 },
  // Notes
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
}, { _id: false });

const GeneratedInvoiceSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['invoice', 'receipt', 'deposit_receipt', 'quotation'],
      default: 'invoice',
    },
    data: {
      type: GeneratedInvoiceDataSchema,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Index for listing invoices by user and type
GeneratedInvoiceSchema.index({ createdBy: 1, type: 1, updatedAt: -1 });
GeneratedInvoiceSchema.index({ name: 'text' });

const GeneratedInvoice: Model<IGeneratedInvoice> =
  mongoose.models.GeneratedInvoice || mongoose.model<IGeneratedInvoice>('GeneratedInvoice', GeneratedInvoiceSchema);

export default GeneratedInvoice;
