import mongoose, { Schema, Document, Model } from 'mongoose';

export type RoomStatus = 'vacant' | 'occupied' | 'maintenance';

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
  waterRate?: number; // Price per unit
  electricityRate?: number; // Price per unit
  depositAmount?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

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
    waterRate: {
      type: Number,
      default: 18, // Default rate per unit
    },
    electricityRate: {
      type: Number,
      default: 8, // Default rate per unit
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
RoomSchema.index({ roomNumber: 1 });
RoomSchema.index({ status: 1 });
RoomSchema.index({ assignmentToken: 1 });

const Room: Model<IRoom> = mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema);

export default Room;
