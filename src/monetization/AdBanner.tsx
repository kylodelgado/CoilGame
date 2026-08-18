import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getAdmobBanner } from '../services/admobAds';
import { useEntitlementsStore } from '../state/useEntitlementsStore';

/**
 * The end-screen banner slot (win/loss ONLY — never during gameplay).
 *
 *   - Premium players: renders nothing at all (no reserved space, no flicker).
 *   - Real mode (AdMob SDK + config present): renders the real adaptive
 *     BannerAd from react-native-google-mobile-ads, resolved through
 *     admobAds.getAdmobBanner() so this file never imports the package.
 *   - Mock mode: renders a truthful placeholder at the exact adaptive-banner
 *     height (AD_BANNER_HEIGHT) so end-screen layout today matches what ships
 *     when real ads flip on.
 */

/** Reserved banner height in pt — matches the anchored adaptive banner slot. */
export const AD_BANNER_HEIGHT = 60;

export function AdBanner() {
  const premium = useEntitlementsStore((s) => s.premium);
  if (premium) {
    return null;
  }

  const real = getAdmobBanner();
  if (real !== null) {
    return (
      <View
        testID="ad-banner-real"
        accessibilityLabel="Advertisement"
        style={styles.slot}
      >
        {createElement(real.Banner, {
          unitId: real.unitId,
          size: real.size,
          requestOptions: real.requestOptions,
        })}
      </View>
    );
  }

  return (
    <View
      testID="ad-banner-mock"
      accessibilityLabel="Advertisement placeholder"
      style={[styles.slot, styles.mockPanel]}
    >
      <View style={styles.mockTag}>
        <Text style={styles.mockTagText}>Ad</Text>
      </View>
      <Text style={styles.mockText}>Your ad here · mock</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: AD_BANNER_HEIGHT,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockPanel: {
    backgroundColor: '#111214',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2c2e33',
    borderRadius: 8,
    marginHorizontal: 16,
    alignSelf: 'stretch',
  },
  mockTag: {
    position: 'absolute',
    top: 4,
    left: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3d44',
  },
  mockTagText: {
    color: '#6d717b',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mockText: { color: '#585c66', fontSize: 13, letterSpacing: 0.5 },
});
