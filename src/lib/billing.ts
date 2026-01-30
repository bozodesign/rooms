import connectDB from './mongodb';
import Invoice from '@/models/Invoice';
import Room from '@/models/Room';
import User from '@/models/User';
import SystemConfig, { CONFIG_KEYS } from '@/models/SystemConfig';

export interface InvoiceInput {
  roomId: string;
  month: number;
  year: number;
  waterUnits: number;
  electricityUnits: number;
  previousWaterReading?: number;
  previousElectricityReading?: number;
  currentWaterReading?: number;
  currentElectricityReading?: number;
  otherCharges?: number;
  otherChargesDescription?: string;
  discount?: number;
  generatedBy?: string;
}

export async function generateInvoice(input: InvoiceInput) {
  await connectDB();

  const room = await Room.findById(input.roomId).populate('tenantId');
  if (!room) {
    throw new Error('Room not found');
  }

  if (!room.tenantId) {
    throw new Error('Room has no tenant assigned');
  }

  // Check if invoice already exists for this month
  const existingInvoice = await Invoice.findOne({
    roomId: input.roomId,
    month: input.month,
    year: input.year,
  });

  if (existingInvoice) {
    throw new Error('Invoice already exists for this period');
  }

  // Calculate amounts
  const rentAmount = room.baseRentPrice;
  const waterAmount = input.waterUnits * (room.waterRate || 18);
  const electricityAmount = input.electricityUnits * (room.electricityRate || 8);
  const otherCharges = input.otherCharges || 0;
  const discount = input.discount || 0;

  const totalAmount = rentAmount + waterAmount + electricityAmount + otherCharges - discount;

  // Get due date from config or default to 5th of next month
  const dueDayConfig = await SystemConfig.findOne({ key: CONFIG_KEYS.DUE_DAY_OF_MONTH });
  const dueDay = dueDayConfig?.value || 5;

  const dueDate = new Date(input.year, input.month, dueDay); // month is already 1-indexed

  const invoice = await Invoice.create({
    roomId: input.roomId,
    tenantId: room.tenantId,
    month: input.month,
    year: input.year,

    waterUnits: input.waterUnits,
    electricityUnits: input.electricityUnits,
    previousWaterReading: input.previousWaterReading,
    previousElectricityReading: input.previousElectricityReading,
    currentWaterReading: input.currentWaterReading,
    currentElectricityReading: input.currentElectricityReading,

    rentAmount,
    waterAmount,
    electricityAmount,
    otherCharges,
    otherChargesDescription: input.otherChargesDescription,
    discount,
    totalAmount,

    paymentStatus: 'pending',
    dueDate,
    generatedBy: input.generatedBy,
  });

  return invoice;
}

export async function batchGenerateInvoices(
  invoices: InvoiceInput[],
  generatedBy?: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const invoiceInput of invoices) {
    try {
      await generateInvoice({ ...invoiceInput, generatedBy });
      results.success++;
    } catch (error: any) {
      results.failed++;
      results.errors.push(`Room ${invoiceInput.roomId}: ${error.message}`);
    }
  }

  return results;
}

export async function markInvoiceAsPaid(
  invoiceId: string,
  paymentMethod: 'promptpay' | 'cash' | 'transfer',
  paymentSlipUrl?: string,
  paymentNote?: string,
  verifiedBy?: string
) {
  await connectDB();

  const invoice = await Invoice.findByIdAndUpdate(
    invoiceId,
    {
      paymentStatus: 'paid',
      paidAt: new Date(),
      paymentMethod,
      paymentSlipUrl,
      paymentNote,
      verifiedBy,
    },
    { new: true }
  );

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  return invoice;
}

export async function updateOverdueInvoices() {
  await connectDB();

  const now = new Date();

  const result = await Invoice.updateMany(
    {
      paymentStatus: 'pending',
      dueDate: { $lt: now },
    },
    {
      paymentStatus: 'overdue',
    }
  );

  return result;
}

export async function getInvoicesByTenant(tenantId: string, limit = 10) {
  await connectDB();

  const invoices = await Invoice.find({ tenantId })
    .sort({ year: -1, month: -1 })
    .limit(limit)
    .populate('roomId', 'roomNumber');

  return invoices;
}

export async function getCurrentMonthInvoice(tenantId: string) {
  await connectDB();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const invoice = await Invoice.findOne({
    tenantId,
    month: currentMonth,
    year: currentYear,
  }).populate('roomId', 'roomNumber');

  return invoice;
}
