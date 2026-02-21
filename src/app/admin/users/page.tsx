'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLiff } from '@/providers/LiffProvider';
import LoadingScreen from '@/components/LoadingScreen';

interface User {
  _id: string;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  phone?: string;
  role: 'admin' | 'tenant';
  roomId?: {
    _id: string;
    roomNumber: string;
  };
  createdAt: string;
}

interface Invitation {
  _id: string;
  inviter: {
    displayName: string;
    pictureUrl?: string;
  };
  invitee?: {
    displayName: string;
    pictureUrl?: string;
  };
  status: string;
  shortUrl: string;
  fullUrl: string;
  expireDate: string;
  usedAt?: string;
  createdAt: string;
}

export default function UsersPage() {
  const { profile, isLoading: isLiffLoading } = useLiff();
  const lineUserId = profile?.userId || '';
  const queryClient = useQueryClient();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch admin users
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin-users', 'admin'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users?role=admin', {
        headers: { 'x-line-userid': lineUserId },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!lineUserId,
  });

  // Fetch invitations
  const { data: invitationsData, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/invitations', {
        headers: { 'x-line-userid': lineUserId },
      });
      if (!res.ok) throw new Error('Failed to fetch invitations');
      return res.json();
    },
    enabled: !!lineUserId,
  });

  // Create invitation mutation
  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ expireHours: 24 }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create invitation');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      // Copy short URL to clipboard
      const url = data.invitation.shortUrl || data.invitation.fullUrl;
      navigator.clipboard.writeText(url);
      setCopiedId('new');
      setTimeout(() => setCopiedId(null), 2000);
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  // Cancel invitation mutation
  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(`/api/admin/invitations?id=${invitationId}`, {
        method: 'DELETE',
        headers: { 'x-line-userid': lineUserId },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to cancel invitation');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  // Remove admin role mutation
  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-line-userid': lineUserId,
        },
        body: JSON.stringify({ role: 'tenant' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRemoveAdmin = (user: User) => {
    if (confirm(`ต้องการยกเลิกสิทธิ์ผู้ดูแลของ ${user.displayName} หรือไม่?`)) {
      removeAdminMutation.mutate(user._id);
    }
  };

  const admins: User[] = usersData?.users || [];
  const activeInvitations: Invitation[] = invitationsData?.invited || [];
  const completedInvitations: Invitation[] = invitationsData?.others || [];

  const isLoading = isLiffLoading || isLoadingUsers || isLoadingInvitations;

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white sticky top-0 z-30">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <a
              href="/admin/settings"
              className="flex items-center gap-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-2 py-1 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>กลับ</span>
            </a>
            <h1 className="text-xl font-bold">พนักงาน</h1>
            <div className="w-16"></div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Create Invitation Button */}
        <button
          onClick={() => createInviteMutation.mutate()}
          disabled={createInviteMutation.isPending || activeInvitations.length >= 5}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
        >
          {createInviteMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>กำลังสร้างลิงก์...</span>
            </>
          ) : copiedId === 'new' ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>คัดลอกลิงก์แล้ว!</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>สร้างลิงก์เชิญผู้ดูแล</span>
            </>
          )}
        </button>

        {activeInvitations.length >= 5 && (
          <p className="text-center text-sm text-orange-600">
            มีลิงก์เชิญที่ใช้งานได้ครบ 5 ลิงก์แล้ว กรุณายกเลิกลิงก์เก่าก่อน
          </p>
        )}

        {/* Active Invitations */}
        {activeInvitations.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              ลิงก์เชิญที่ใช้งานได้ ({activeInvitations.length})
            </h2>
            <div className="space-y-3">
              {activeInvitations.map((inv) => (
                <div key={inv._id} className="bg-white rounded-xl p-4 shadow-sm border border-orange-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {inv.inviter.pictureUrl ? (
                        <img
                          src={inv.inviter.pictureUrl}
                          alt={inv.inviter.displayName}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <span className="text-sm text-gray-600">สร้างโดย {inv.inviter.displayName}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      หมดอายุ {new Date(inv.expireDate).toLocaleString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyLink(inv.shortUrl || inv.fullUrl, inv._id)}
                      className="flex-1 py-2 px-3 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedId === inv._id ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          คัดลอกแล้ว!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          คัดลอกลิงก์
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('ต้องการยกเลิกลิงก์เชิญนี้หรือไม่?')) {
                          cancelInviteMutation.mutate(inv._id);
                        }
                      }}
                      disabled={cancelInviteMutation.isPending}
                      className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admins List */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            ผู้ดูแลระบบ ({admins.length})
          </h2>
          {admins.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-xl">
              ไม่มีผู้ดูแลระบบ
            </div>
          ) : (
            <div className="space-y-3">
              {admins.map((user) => (
                <div key={user._id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3">
                    {user.pictureUrl ? (
                      <img
                        src={user.pictureUrl}
                        alt={user.displayName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{user.displayName}</h3>
                        {user.lineUserId === lineUserId && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">คุณ</span>
                        )}
                      </div>
                      {user.phone && (
                        <p className="text-sm text-gray-500">{user.phone}</p>
                      )}
                    </div>
                    {user.lineUserId !== lineUserId && (
                      <button
                        onClick={() => handleRemoveAdmin(user)}
                        disabled={removeAdminMutation.isPending}
                        className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        ยกเลิกสิทธิ์
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invitation History */}
        {completedInvitations.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ประวัติการเชิญ
            </h2>
            <div className="space-y-3">
              {completedInvitations.map((inv) => (
                <div key={inv._id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3">
                    {/* Inviter */}
                    <div className="flex items-center gap-2">
                      {inv.inviter.pictureUrl ? (
                        <img
                          src={inv.inviter.pictureUrl}
                          alt={inv.inviter.displayName}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <span className="text-sm text-gray-600 truncate max-w-20">{inv.inviter.displayName}</span>
                    </div>

                    {/* Arrow with status */}
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-px bg-gray-300"></div>
                      {inv.status === 'accepted' ? (
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : inv.status === 'declined' ? (
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </div>
                      )}
                      <div className="w-4 h-px bg-gray-300"></div>
                    </div>

                    {/* Invitee */}
                    {inv.invitee ? (
                      <div className="flex items-center gap-2 flex-1">
                        {inv.invitee.pictureUrl ? (
                          <img
                            src={inv.invitee.pictureUrl}
                            alt={inv.invitee.displayName}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        <span className="text-sm text-gray-600 truncate">{inv.invitee.displayName}</span>
                      </div>
                    ) : (
                      <div className="flex-1 text-sm text-gray-400">
                        {inv.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'ไม่มีผู้รับ'}
                      </div>
                    )}

                    {/* Timestamp */}
                    <span className="text-xs text-gray-400">
                      {inv.usedAt
                        ? new Date(inv.usedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
                        : new Date(inv.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
