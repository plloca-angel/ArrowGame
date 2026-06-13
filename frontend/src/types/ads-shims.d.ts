/**
 * Shims until `npm install` adds real packages (CI / offline).
 * After packages install, delete this file if TypeScript reports duplicate `declare module` errors.
 */

declare module "react-native-google-mobile-ads" {
  export const TestIds: { INTERSTITIAL: string };
  export enum AdEventType {
    LOADED = "loaded",
    CLOSED = "closed",
    ERROR = "error",
  }
  export enum AdsConsentStatus {
    REQUIRED = "REQUIRED",
  }
  export const AdsConsent: {
    requestInfoUpdate(): Promise<{ status: AdsConsentStatus }>;
    showForm(): Promise<unknown>;
  };
  export class InterstitialAd {
    static createForAdRequest(_unitId: string, _opts?: object): InterstitialAd;
    addAdEventListener(_event: AdEventType, _cb: () => void): () => void;
    load(): void;
    show(): Promise<void>;
  }
  const _default: () => { initialize(): Promise<void> };
  export default _default;
}

declare module "expo-tracking-transparency" {
  export function requestTrackingPermissionsAsync(): Promise<{
    status: string;
  }>;
}
