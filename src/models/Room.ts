import mongoose, { Schema, Document, Model } from 'mongoose';

export type RoomStatus = 'vacant' | 'occupied' | 'maintenance';

// Room log event types
export type RoomLogEventType =
  | 'check_in'        // Tenant moved in (scanned QR code)
  | 'check_out'       // Tenant moved out (evicted)
  | 'status_change'   // Room status changed (vacant/occupied/maintenance)
  | 'maintenance'     // Maintenance event
  | 'meter_reading'   // Meter reading recorded
  | 'rate_change'     // Water/electricity rate changed
  | 'note_added'      // Note added to room
  | 'other';          // Other events

// Room log entry
export interface IRoomLog {
  eventType: RoomLogEventType;
  eventAt: Date;
  performedBy?: string; // LINE userId (admin or tenant)
  performedByRole?: 'admin' | 'tenant' | 'system';
  description: string;
  metadata?: {
    previousStatus?: RoomStatus;
    newStatus?: RoomStatus;
    tenantId?: string;
    tenantName?: string;
    [key: string]: any;
  };
}

// Meter reading history entry
export interface IMeterReadingHistory {
  value: number;
  recordedAt: Date;
  recordedBy?: string; // Admin LINE userId who recorded
  notes?: string;
}

// Occupancy period entry (for availability calendar)
export interface IOccupancyPeriod {
  _id?: string;
  startDate: Date;
  endDate?: Date; // null means ongoing/current occupancy
  tenantName?: string;
  notes?: string;
  createdAt: Date;
}

export interface IRoom extends Document {
  roomNumber: string;
  floor: number;
  baseRentPrice: number;
  status: RoomStatus;
  tenantId?: mongoose.Types.ObjectId;
  assignmentToken?: string; // Token for QR code room assignment
  tokenExpiresAt?: Date;
  waterMeterNumber?: string; // Water meter identification number
  electricityMeterNumber?: string; // Electricity meter identification number
  waterMeterReadings: IMeterReadingHistory[]; // History of water meter readings
  electricityMeterReadings: IMeterReadingHistory[]; // History of electricity meter readings
  waterRate?: number; // Price per unit
  electricityRate?: number; // Price per unit
  hasMotorcycleParking?: boolean; // Motorcycle parking rental
  motorcycleParkingRate?: number; // Motorcycle parking rate (default 200)
  depositAmount?: number;
  notes?: string;
  roomLogs: IRoomLog[]; // History of room events
  occupancyPeriods: IOccupancyPeriod[]; // History of occupancy periods
  createdAt: Date;
  updatedAt: Date;
}

// Sub-schema for meter reading history
const MeterReadingHistorySchema = new Schema(
  {
    value: {
      type: Number,
      required: true,
    },
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    recordedBy: {
      type: String, // Admin LINE userId
    },
    notes: {
      type: String,
    },
  },
  { _id: false }
);

// Sub-schema for occupancy period
const OccupancyPeriodSchema = new Schema(
  {
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date, // null means ongoing
    },
    tenantName: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// Sub-schema for room log
const RoomLogSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: ['check_in', 'check_out', 'status_change', 'maintenance', 'meter_reading', 'rate_change', 'note_added', 'other'],
      required: true,
    },
    eventAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    performedBy: {
      type: String, // LINE userId
    },
    performedByRole: {
      type: String,
      enum: ['admin', 'tenant', 'system'],
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed, // Flexible object for additional data
    },
  },
  { _id: false }
);

const RoomSchema: Schema = new Schema(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    floor: {
      type: Number,
      required: true,
    },
    baseRentPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['vacant', 'occupied', 'maintenance'],
      default: 'vacant',
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignmentToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    tokenExpiresAt: {
      type: Date,
    },
    waterMeterNumber: {
      type: String,
      trim: true,
    },
    electricityMeterNumber: {
      type: String,
      trim: true,
    },
    waterMeterReadings: {
      type: [MeterReadingHistorySchema],
      default: [],
    },
    electricityMeterReadings: {
      type: [MeterReadingHistorySchema],
      default: [],
    },
    waterRate: {
      type: Number,
      default: 18, // Default rate per unit
    },
    electricityRate: {
      type: Number,
      default: 8, // Default rate per unit
    },
    hasMotorcycleParking: {
      type: Boolean,
      default: false,
    },
    motorcycleParkingRate: {
      type: Number,
      default: 200, // Default 200 baht per month
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
    },
    roomLogs: {
      type: [RoomLogSchema],
      default: [],
    },
    occupancyPeriods: {
      type: [OccupancyPeriodSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (roomNumber and assignmentToken already indexed via unique: true)
RoomSchema.index({ status: 1 });
// Composite index for common sorting pattern (floor + roomNumber)
RoomSchema.index({ floor: 1, roomNumber: 1 });
// Index for tenant lookups
RoomSchema.index({ tenantId: 1 });
// Composite index for filtering by status with sorting
RoomSchema.index({ status: 1, floor: 1 });

const Room: Model<IRoom> = mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema);

export default Room;
