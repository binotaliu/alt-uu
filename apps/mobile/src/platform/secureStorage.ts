import * as SecureStore from 'expo-secure-store';
import type { SecureStorage } from '@altuu/core';

/** Keychain / Keystore backed storage. */
export const secureStorage: SecureStorage = {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key),
};
