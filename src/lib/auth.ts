import { headers } from 'next/headers';
import connectDB from './mongodb';
import User, { IUser } from '@/models/User';

export async function getCurrentUser(lineUserId: string): Promise<IUser | null> {
  await connectDB();

  const user = await User.findOne({ lineUserId, isActive: true });
  return user;
}

export async function isAdmin(lineUserId: string): Promise<boolean> {
  const adminIds = process.env.ADMIN_LINE_USERIDS?.split(',') || [];
  if (adminIds.includes(lineUserId)) {
    return true;
  }

  const user = await getCurrentUser(lineUserId);
  return user?.role === 'admin';
}

export async function requireAuth(request: Request): Promise<string> {
  const lineUserId = request.headers.get('x-line-userid');

  if (!lineUserId) {
    throw new Error('Unauthorized: LINE User ID not found');
  }

  return lineUserId;
}

export async function requireAdmin(request: Request): Promise<string> {
  const lineUserId = await requireAuth(request);
  const isAdminUser = await isAdmin(lineUserId);

  if (!isAdminUser) {
    throw new Error('Forbidden: Admin access required');
  }

  return lineUserId;
}

// Create or update user from LIFF profile
export async function upsertUserFromProfile(profile: {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}): Promise<IUser> {
  await connectDB();
  console.log('connectDB completed');

  const adminIds = process.env.ADMIN_LINE_USERIDS?.split(',').map(id => id.trim()) || [];
  const isAdminUser = adminIds.includes(profile.userId);

  console.log('Admin check:', {
    adminIds,
    profileUserId: profile.userId,
    isAdminUser
  });

  console.log('Finding/creating user with data:', {
    lineUserId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl,
    role: isAdminUser ? 'admin' : 'tenant',
    isActive: true,
  });

  const user = await User.findOneAndUpdate(
    { lineUserId: profile.userId },
    {
      lineUserId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      role: isAdminUser ? 'admin' : 'tenant',
      isActive: true,
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  console.log('User upserted in database:', {
    _id: user._id,
    lineUserId: user.lineUserId,
    role: user.role
  });

  return user;
}
