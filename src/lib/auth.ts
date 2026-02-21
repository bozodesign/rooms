import connectDB from './mongodb';
import User, { IUser } from '@/models/User';

export async function getCurrentUser(lineUserId: string): Promise<IUser | null> {
  await connectDB();

  const user = await User.findOne({ lineUserId, isActive: true });
  return user;
}

export async function isAdmin(lineUserId: string): Promise<boolean> {
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
// Note: Role is managed in database, not via env variable
// New users default to 'tenant', admins must be set manually in DB
export async function upsertUserFromProfile(profile: {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}): Promise<IUser> {
  await connectDB();

  // Check if user already exists to preserve their role
  const existingUser = await User.findOne({ lineUserId: profile.userId });

  // Keep existing role if user exists, otherwise default to 'tenant'
  const role = existingUser?.role || 'tenant';

  const user = await User.findOneAndUpdate(
    { lineUserId: profile.userId },
    {
      lineUserId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      role,
      isActive: true,
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  return user;
}
