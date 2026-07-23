/**
 * Thin wrapper around react-native-iap for the one-time premium unlock.
 *
 * react-native-iap is a native module, so it is unavailable in Expo Go
 * and on web — there (and in dev) we fall back to a mock that simply
 * "succeeds", letting the purchase flow be exercised end-to-end. Real
 * store purchases require an EAS development/production build with the
 * product below configured in App Store Connect / Google Play Console.
 */
export const PREMIUM_PRODUCT_ID = 'io.luvlab.grandma.premium';

interface IapModule {
  initConnection: () => Promise<boolean>;
  endConnection: () => Promise<void>;
  getProducts: (params: { skus: string[] }) => Promise<unknown[]>;
  requestPurchase: (params: { skus: string[] }) => Promise<unknown>;
  getAvailablePurchases: () => Promise<Array<{ productId: string }>>;
}

function loadIap(): IapModule | null {
  try {
    // Inline require so the app still runs where the native module
    // isn't linked (Expo Go, web).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-iap') as IapModule;
  } catch {
    return null;
  }
}

export interface PurchaseResult {
  success: boolean;
  /** True when the store was unavailable and the mock path was used. */
  mock: boolean;
}

/** Kick off the one-time premium purchase. Resolves once it settles. */
export async function purchasePremium(): Promise<PurchaseResult> {
  const iap = loadIap();
  if (!iap) {
    return { success: true, mock: true };
  }
  try {
    await iap.initConnection();
    await iap.getProducts({ skus: [PREMIUM_PRODUCT_ID] });
    await iap.requestPurchase({ skus: [PREMIUM_PRODUCT_ID] });
    return { success: true, mock: false };
  } catch {
    return { success: false, mock: false };
  } finally {
    iap.endConnection().catch(() => undefined);
  }
}

/** Check the store for a previously bought premium unlock. */
export async function restorePremium(): Promise<PurchaseResult> {
  const iap = loadIap();
  if (!iap) {
    return { success: false, mock: true };
  }
  try {
    await iap.initConnection();
    const purchases = await iap.getAvailablePurchases();
    const owned = purchases.some(
      (purchase) => purchase.productId === PREMIUM_PRODUCT_ID
    );
    return { success: owned, mock: false };
  } catch {
    return { success: false, mock: false };
  } finally {
    iap.endConnection().catch(() => undefined);
  }
}
