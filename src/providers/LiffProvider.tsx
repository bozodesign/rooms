'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { liffService, LiffProfile } from '@/lib/liff';

interface LiffContextType {
  isReady: boolean;
  isLoggedIn: boolean;
  profile: LiffProfile | null;
  liff: typeof liffService | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const LiffContext = createContext<LiffContextType>({
  isReady: false,
  isLoggedIn: false,
  profile: null,
  liff: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  error: null,
});

export const useLiff = () => useContext(LiffContext);

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeLiff = async () => {
      try {
        await liffService.init();
        const loggedIn = liffService.isLoggedIn();
        setIsLoggedIn(loggedIn);

        if (loggedIn) {
          const userProfile = await liffService.getProfile();
          setProfile(userProfile);

          // Log user information to console
          console.log('=== LINE User Login ===');
          console.log('LINE User ID:', userProfile.userId);
          console.log('Display Name:', userProfile.displayName);
          console.log('Profile:', userProfile);
          console.log('======================');

          // Sync profile with backend
          await fetch('/api/auth/profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-line-userid': userProfile.userId,
            },
            body: JSON.stringify(userProfile),
          });
        }

        setIsReady(true);
      } catch (err: any) {
        console.error('LIFF initialization error:', err);
        setError(err.message);
        setIsReady(true);
      }
    };

    initializeLiff();
  }, []);

  const login = async () => {
    try {
      await liffService.login();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const logout = async () => {
    try {
      await liffService.logout();
      setIsLoggedIn(false);
      setProfile(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <LiffContext.Provider value={{
      isReady,
      isLoggedIn,
      profile,
      liff: liffService,
      isLoading: !isReady,
      login,
      logout,
      error
    }}>
      {children}
    </LiffContext.Provider>
  );
}
