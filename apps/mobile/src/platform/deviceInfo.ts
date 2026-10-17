import type { DeviceInfo } from '@altuu/core';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** Device and build details for the diagnostic bundle. */
export function getDeviceInfo(): DeviceInfo {
    return {
        platform:
            Platform.OS === 'android'
                ? 'android'
                : Platform.isTV
                  ? 'tvos'
                  : 'ios',
        osVersion: Device.osVersion ?? String(Platform.Version),
        appVersion: Application.nativeApplicationVersion ?? 'unknown',
        buildNumber: Application.nativeBuildVersion,
        deviceModel: Device.modelId ?? Device.modelName,
    };
}
