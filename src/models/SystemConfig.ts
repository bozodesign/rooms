import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISystemConfig extends Document {
  key: string;
  value: any;
  description?: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SystemConfigSchema: Schema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

SystemConfigSchema.index({ key: 1 });

const SystemConfig: Model<ISystemConfig> =
  mongoose.models.SystemConfig || mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);

export default SystemConfig;

// Helper functions for common config keys
export const CONFIG_KEYS = {
  DUE_DAY_OF_MONTH: 'dueDay',
  DEFAULT_WATER_RATE: 'defaultWaterRate',
  DEFAULT_ELECTRICITY_RATE: 'defaultElectricityRate',
  PROMPTPAY_ID: 'promptpayId',
  DORM_NAME: 'dormName',
  DORM_ADDRESS: 'dormAddress',
  ADMIN_LINE_IDS: 'adminLineIds',
} as const;
