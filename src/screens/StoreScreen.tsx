import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  MOCK_PREMIUM_PRODUCT,
  PREMIUM_PRODUCT_ID,
  type Product,
} from '../services/PurchasesPort';
import {
  appPurchases,
  restorePurchases,
} from '../services/purchasesInstance';
import { useEntitlementsStore } from '../state/useEntitlementsStore';
import { GlowButton, MIN_TOUCH, Panel, ScreenShell, useTheme } from '../ui';

/**
 * The premium store: one non-consumable, coil.premium ("Coil Premium" —
 * removes all ads forever, revives without watching). Works fully against the
 * mock today (purchase always succeeds after a short delay) and against the
 * real store the moment expo-iap + config land — this screen only ever talks
 * to the PurchasesPort singleton. Styled as part of the game world: the
 * skin's board art behind everything, the coiled-snake key art in a circular
 * medallion over the title, every color from the active skin's ui block.
 * (Monetization)
 */

type PurchasePhase = 'idle' | 'purchasing' | 'failed' | 'cancelled';
type RestorePhase = 'idle' | 'restoring' | 'restored' | 'nothing';

const BENEFITS = [
  'No ads — ever',
  'Instant revives, no ad to watch',
  'Support development',
] as const;

/** The coiled-snake key art (1200×700), cropped to a circular medallion. */
const HERO_ART = require('../../assets/board/props/hero.webp');
const HERO_SIZE = 140;

export function StoreScreen() {
  const router = useRouter();
  const { ui, spacing, radius, type } = useTheme();
  const accent = ui.accent;

  const premium = useEntitlementsStore((s) => s.premium);
  const grantPremium = useEntitlementsStore((s) => s.grantPremium);

  const [product, setProduct] = useState<Product | null>(null);
  const [purchasePhase, setPurchasePhase] = useState<PurchasePhase>('idle');
  const [restorePhase, setRestorePhase] = useState<RestorePhase>('idle');
  // Distinguishes "just bought it here" (celebrate) from "arrived premium".
  const [justPurchased, setJustPurchased] = useState(false);

  useEffect(() => {
    let mounted = true;
    void appPurchases
      .initialize()
      .then(() => appPurchases.getProducts())
      .then((products) => {
        if (!mounted) {
          return;
        }
        const premiumProduct =
          products.find((p) => p.id === PREMIUM_PRODUCT_ID) ?? null;
        // Fall back to the local catalog entry so the screen never dead-ends
        // (a transient store error should not hide the price forever).
        setProduct(premiumProduct ?? { ...MOCK_PREMIUM_PRODUCT });
      })
      .catch(() => {
        if (mounted) {
          setProduct({ ...MOCK_PREMIUM_PRODUCT });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const onBuy = async (): Promise<void> => {
    if (purchasePhase === 'purchasing' || premium) {
      return;
    }
    setPurchasePhase('purchasing');
    try {
      const result = await appPurchases.purchase(PREMIUM_PRODUCT_ID);
      if (result === 'purchased') {
        grantPremium();
        setJustPurchased(true);
        setPurchasePhase('idle');
      } else {
        setPurchasePhase(result === 'cancelled' ? 'cancelled' : 'failed');
      }
    } catch {
      setPurchasePhase('failed');
    }
  };

  const onRestore = async (): Promise<void> => {
    if (restorePhase === 'restoring') {
      return;
    }
    setRestorePhase('restoring');
    const ids = await restorePurchases();
    setRestorePhase(ids.includes(PREMIUM_PRODUCT_ID) ? 'restored' : 'nothing');
  };

  const priceLabel = product?.priceString ?? null;

  return (
    <ScreenShell world testID="store-screen" contentStyle={styles.content}>
      {/* Key-art medallion above the title. */}
      <View
        style={[
          styles.heroMedallion,
          {
            borderColor: ui.border,
            backgroundColor: ui.surfaceRaised,
            shadowColor: accent,
          },
        ]}
      >
        <Image
          source={HERO_ART}
          resizeMode="cover"
          accessible={false}
          style={styles.heroArt}
        />
      </View>

      <Text
        testID="store-hero"
        accessibilityRole="header"
        style={[
          type.title,
          styles.heroTitle,
          { color: accent, textShadowColor: accent },
        ]}
      >
        Coil Premium
      </Text>
      <Text
        style={[type.caption, { color: ui.textSecondary, marginTop: spacing.xs }]}
      >
        One purchase. Yours forever.
      </Text>

      <Panel
        testID="store-benefits"
        style={[styles.benefits, { marginVertical: spacing.xl }]}
      >
        {BENEFITS.map((benefit) => (
          <View key={benefit} style={[styles.benefitRow, { gap: spacing.sm }]}>
            <Text style={[styles.benefitBullet, { color: accent }]}>·</Text>
            <Text style={[type.body, { color: ui.textPrimary }]}>
              {benefit}
            </Text>
          </View>
        ))}
      </Panel>

      {premium ? (
        <Panel
          testID="store-success"
          glow
          style={[styles.successPanel, { gap: spacing.sm }]}
        >
          <Text style={[type.heading, { color: accent }]}>
            {justPurchased ? 'Welcome to Premium!' : 'You own Coil Premium'}
          </Text>
          <Text
            style={[type.caption, styles.centeredText, { color: ui.textSecondary }]}
          >
            {justPurchased
              ? 'Ads are gone forever and revives are instant. Thank you for supporting Coil!'
              : 'Ads are off and revives are instant on this device.'}
          </Text>
        </Panel>
      ) : (
        <>
          <Pressable
            testID="store-buy-button"
            accessibilityRole="button"
            accessibilityLabel={
              priceLabel === null
                ? 'Buy Coil Premium'
                : `Buy Coil Premium for ${priceLabel}`
            }
            accessibilityState={{
              disabled: purchasePhase === 'purchasing' || priceLabel === null,
            }}
            disabled={purchasePhase === 'purchasing' || priceLabel === null}
            onPress={() => void onBuy()}
            style={[
              styles.buyButton,
              {
                backgroundColor: accent,
                borderRadius: radius.lg,
                shadowColor: accent,
              },
            ]}
          >
            {purchasePhase === 'purchasing' ? (
              <ActivityIndicator
                testID="store-buy-spinner"
                color={ui.onAccent}
              />
            ) : (
              <Text style={[styles.buyLabel, { color: ui.onAccent }]}>
                {priceLabel === null
                  ? 'Loading price…'
                  : `Get Premium · ${priceLabel}`}
              </Text>
            )}
          </Pressable>

          {purchasePhase === 'failed' && (
            <Text
              testID="store-error"
              style={[type.caption, { color: ui.danger, marginTop: spacing.md }]}
            >
              Something went wrong — you were not charged. Please try again.
            </Text>
          )}
          {purchasePhase === 'cancelled' && (
            <Text
              testID="store-cancelled"
              style={[
                type.caption,
                { color: ui.textSecondary, marginTop: spacing.md },
              ]}
            >
              Purchase cancelled.
            </Text>
          )}
        </>
      )}

      <Pressable
        testID="store-restore"
        accessibilityRole="button"
        accessibilityLabel="Restore purchases"
        disabled={restorePhase === 'restoring'}
        onPress={() => void onRestore()}
        style={[styles.restoreLink, { marginTop: spacing.lg }]}
      >
        <Text style={[styles.restoreText, { color: accent }]}>
          {restorePhase === 'restoring' ? 'Restoring…' : 'Restore Purchases'}
        </Text>
      </Pressable>
      {restorePhase === 'restored' && (
        <Text
          testID="store-restored"
          style={[type.caption, { color: ui.textSecondary, marginTop: spacing.sm }]}
        >
          Purchases restored.
        </Text>
      )}
      {restorePhase === 'nothing' && (
        <Text
          testID="store-restore-empty"
          style={[type.caption, { color: ui.textSecondary, marginTop: spacing.sm }]}
        >
          No previous purchases found.
        </Text>
      )}

      <View style={styles.spacer} />

      <Text
        style={[styles.finePrint, { color: ui.textSecondary }]}
      >
        Payment is charged to your store account. Premium is a one-time,
        non-consumable purchase tied to that account.{' '}
        <Text
          testID="store-legal-terms"
          accessibilityRole="link"
          accessibilityLabel="Terms of service"
          style={[styles.finePrintLink, { color: accent }]}
          onPress={() => router.push('/legal/terms')}
        >
          Terms
        </Text>
        {' · '}
        <Text
          testID="store-legal-privacy"
          accessibilityRole="link"
          accessibilityLabel="Privacy policy"
          style={[styles.finePrintLink, { color: accent }]}
          onPress={() => router.push('/legal/privacy')}
        >
          Privacy
        </Text>
      </Text>

      <GlowButton
        testID="store-back-button"
        label="Back"
        variant="secondary"
        onPress={() => router.back()}
        style={[styles.backButton, { marginTop: spacing.lg }]}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  heroMedallion: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: HERO_SIZE / 2,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  // Cover-crop the wide render so the raised head fills the circle.
  heroArt: {
    width: HERO_SIZE * 1.7,
    height: HERO_SIZE,
    marginLeft: -HERO_SIZE * 0.35,
  },
  heroTitle: {
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  benefits: { alignSelf: 'stretch', gap: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center' },
  benefitBullet: { fontSize: 24, fontWeight: '800', lineHeight: 24 },
  successPanel: { alignSelf: 'stretch', alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  buyButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    minHeight: 56,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 6,
  },
  buyLabel: { fontSize: 18, fontWeight: '800' },
  restoreLink: { padding: 8, minHeight: MIN_TOUCH, justifyContent: 'center' },
  restoreText: { fontSize: 15, fontWeight: '600' },
  spacer: { flex: 1 },
  finePrint: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  finePrintLink: { textDecorationLine: 'underline' },
  backButton: { alignSelf: 'stretch' },
});
