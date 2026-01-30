import { randomBytes } from 'crypto';
import connectDB from './mongodb';
import Room from '@/models/Room';
import User from '@/models/User';

const TOKEN_EXPIRY_HOURS = 24;

export async function generateRoomAssignmentToken(roomId: string): Promise<string> {
  await connectDB();

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

  const room = await Room.findByIdAndUpdate(
    roomId,
    {
      assignmentToken: token,
      tokenExpiresAt: expiresAt,
    },
    { new: true }
  );

  if (!room) {
    throw new Error('Room not found');
  }

  return token;
}

export async function assignRoomToTenant(
  token: string,
  lineUserId: string,
  contractStartDate?: Date,
  contractEndDate?: Date
): Promise<{ success: boolean; message: string; roomNumber?: string }> {
  await connectDB();

  // Find room by token
  const room = await Room.findOne({
    assignmentToken: token,
    tokenExpiresAt: { $gt: new Date() },
  });

  if (!room) {
    return {
      success: false,
      message: 'Invalid or expired assignment token',
    };
  }

  // Check if room is already occupied
  if (room.status === 'occupied') {
    return {
      success: false,
      message: 'This room is already occupied',
    };
  }

  // Check if user already has a room
  const existingUser = await User.findOne({
    lineUserId,
    roomId: { $exists: true, $ne: null },
    isActive: true,
  });

  if (existingUser) {
    return {
      success: false,
      message: 'You are already assigned to a room',
    };
  }

  // Find or create user
  let user = await User.findOne({ lineUserId });

  if (!user) {
    return {
      success: false,
      message: 'User profile not found. Please ensure you are logged in via LINE.',
    };
  }

  // Assign room to user
  user.roomId = room._id;
  user.contractStartDate = contractStartDate || new Date();
  user.contractEndDate = contractEndDate;
  await user.save();

  // Update room status
  room.tenantId = user._id;
  room.status = 'occupied';
  room.assignmentToken = undefined; // Clear the token
  room.tokenExpiresAt = undefined;
  await room.save();

  return {
    success: true,
    message: `Successfully assigned to room ${room.roomNumber}`,
    roomNumber: room.roomNumber,
  };
}

export function generateAssignmentUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/tenant/join?token=${token}`;
}

export async function getRoomByToken(token: string) {
  await connectDB();

  const room = await Room.findOne({
    assignmentToken: token,
    tokenExpiresAt: { $gt: new Date() },
  });

  return room;
}
