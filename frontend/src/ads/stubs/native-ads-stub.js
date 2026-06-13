/** Metro stub — Expo Go has no AdMob native module. */
const noop = () => {};
const noopUnsub = () => noop;

const interstitial = {
  addAdEventListener: () => noopUnsub,
  load: noop,
  show: async () => {},
};

module.exports = {
  default: () => ({
    initialize: async () => {},
  }),
  TestIds: { INTERSTITIAL: "ca-app-pub-3940256099942544/1033173712" },
  InterstitialAd: {
    createForAdRequest: () => interstitial,
  },
  AdEventType: { LOADED: "loaded", CLOSED: "closed", ERROR: "error" },
  AdsConsent: {
    requestInfoUpdate: async () => ({ status: "NOT_REQUIRED" }),
    showForm: async () => {},
  },
  AdsConsentStatus: { REQUIRED: "REQUIRED" },
  MobileAds: () => ({ initialize: async () => {} }),
};
