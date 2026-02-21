'use client';

declare global {
  interface Window {
    liff: any;
  }
}

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

class LiffService {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      throw new Error('LIFF ID is not configured');
    }

    try {
      await window.liff.init({ liffId });
      this.initialized = true;
    } catch (error) {
      console.error('LIFF initialization failed:', error);
      throw error;
    }
  }

  isLoggedIn(): boolean {
    return window.liff?.isLoggedIn() ?? false;
  }

  async login(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    window.liff.login();
  }

  async logout(): Promise<void> {
    if (this.isLoggedIn()) {
      window.liff.logout();
    }
  }

  async getProfile(): Promise<LiffProfile> {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.isLoggedIn()) {
      throw new Error('User is not logged in');
    }

    const profile = await window.liff.getProfile();
    return profile;
  }

  async getAccessToken(): Promise<string> {
    if (!this.initialized) {
      await this.init();
    }

    return window.liff.getAccessToken();
  }

  isInClient(): boolean {
    return window.liff?.isInClient() ?? false;
  }

  async closeWindow(): Promise<void> {
    if (this.isInClient()) {
      window.liff.closeWindow();
    }
  }

  async sendMessages(messages: any[]): Promise<void> {
    if (!this.isInClient()) {
      throw new Error('sendMessages can only be used within LINE app');
    }
    await window.liff.sendMessages(messages);
  }

  async openWindow(url: string, external = false): Promise<void> {
    window.liff.openWindow({
      url,
      external,
    });
  }

  async getFriendship(): Promise<{ friendFlag: boolean }> {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.isLoggedIn()) {
      throw new Error('User is not logged in');
    }

    return window.liff.getFriendship();
  }
}

export const liffService = new LiffService();
