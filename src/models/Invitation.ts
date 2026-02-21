import mongoose, { Schema, Document, Model } from 'mongoose';

export type InvitationStatus = 'invited' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface IInvitation extends Document {
  inviter: {
    lineUserId: string;
    displayName: string;
    pictureUrl?: string;
  };
  invitee?: {
    lineUserId: string;
    displayName: string;
    pictureUrl?: string;
  };
  secretCode: string;
  status: InvitationStatus;
  expireDate: Date;
  usedAt?: Date;
  fullUrl: string;
  shortUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema: Schema = new Schema(
  {
    inviter: {
      lineUserId: { type: String, required: true },
      displayName: { type: String, required: true },
      pictureUrl: { type: String },
    },
    invitee: {
      lineUserId: { type: String },
      displayName: { type: String },
      pictureUrl: { type: String },
    },
    secretCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['invited', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'invited',
    },
    expireDate: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
    },
    fullUrl: {
      type: String,
      required: true,
    },
    shortUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
InvitationSchema.index({ status: 1, expireDate: 1 });

// TTL index to auto-delete expired invitations after 7 days
InvitationSchema.index({ expireDate: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const Invitation: Model<IInvitation> =
  mongoose.models.Invitation || mongoose.model<IInvitation>('Invitation', InvitationSchema);

export default Invitation;
