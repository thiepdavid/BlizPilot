import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let nativeStorageInitialization: Promise<void> | undefined;
function initializeNativeSecureStorage() {
  nativeStorageInitialization ??= (async () => {
    await SecureStorage.setKeyPrefix('bizpilot-auth_');
    await SecureStorage.setSynchronize(false);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  })();
  return nativeStorageInitialization;
}

const nativeAuthStorage = {
  async getItem(key: string) {
    await initializeNativeSecureStorage();
    const secureValue = await SecureStorage.getItem(key);
    if (secureValue !== null) return secureValue;

    // Move an existing Supabase session out of WebView storage on the first app launch.
    const legacyValue = window.localStorage.getItem(key);
    if (legacyValue === null) return null;
    await SecureStorage.setItem(key, legacyValue);
    window.localStorage.removeItem(key);
    return legacyValue;
  },
  async setItem(key: string, value: string) {
    await initializeNativeSecureStorage();
    await SecureStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    await initializeNativeSecureStorage();
    await SecureStorage.removeItem(key);
    window.localStorage.removeItem(key);
  },
};

export const supabase = url && anonKey ? createClient(url, anonKey, {
  auth: Capacitor.isNativePlatform() ? { storage: nativeAuthStorage } : undefined,
}) : null;
