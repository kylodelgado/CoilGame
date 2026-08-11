// Global test setup.

// react-native-gesture-handler's jest setup installs JS stand-ins for its
// native module so GestureHandlerRootView/GestureDetector render under jest.
require('react-native-gesture-handler/jestSetup');

// Mock the AsyncStorage native module with the official in-memory mock so any
// module that imports the adapter loads safely. Tests that need to assert
// storage behavior can still jest.mock it locally.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Safe-area context needs a native provider; stub the provider/hooks so screens
// using insets render under jest with zero insets.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const passthrough =
    () =>
    ({ children }) =>
      React.createElement(View, null, children ?? null);
  return {
    SafeAreaProvider: passthrough(),
    SafeAreaView: passthrough(),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// expo-haptics talks to a native module; no-op it so production code paths that
// reference it load safely under jest. Tests asserting haptics mock it locally.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Skia's canvas needs native/CanvasKit; stand the declarative components in with
// plain Views so any component tree that renders them mounts under jest. The
// imperative bits the smooth-snake renderer uses (useClock, the Skia path
// factory) are stubbed with inert no-ops so worklets build without CanvasKit.
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough =
    () =>
    ({ children }) =>
      React.createElement(View, null, children ?? null);
  // A fresh recording path per Make(): tests assert on what geometry a builder
  // emitted, which a shared no-op singleton could never show.
  const makePath = () => {
    const ops = [];
    const path = { ops, isEmpty: () => ops.length === 0 };
    for (const name of [
      'addRRect', 'addRect', 'addCircle', 'moveTo', 'lineTo', 'quadTo', 'cubicTo', 'close',
    ]) {
      path[name] = (...args) => {
        ops.push({ op: name, args });
        return path;
      };
    }
    for (const name of ['reset', 'rewind']) {
      path[name] = () => {
        ops.length = 0;
        return path;
      };
    }
    return path;
  };
  return {
    Canvas: passthrough(),
    Group: passthrough(),
    Fill: passthrough(),
    Rect: passthrough(),
    RoundedRect: passthrough(),
    Circle: passthrough(),
    Path: passthrough(),
    Image: passthrough(),
    Vertices: passthrough(),
    ImageShader: passthrough(),
    Line: passthrough(),
    LinearGradient: passthrough(),
    Shadow: passthrough(),
    vec: (x, y) => ({ x, y }),
    useClock: () => ({ value: 0 }),
    // Stand in for a decoded SkImage so sprite-backed trees mount.
    useImage: () => ({ width: () => 320, height: () => 320 }),
    Skia: {
      Path: { Make: makePath },
      XYWHRect: (x, y, width, height) => ({ x, y, width, height }),
      RRectXY: (rect) => rect,
    },
  };
});

// Reanimated's index pulls in react-native-worklets' native module, which
// throws under jest. Swap in Reanimated's own built jest mock (pure JS, no
// native): it covers the worklet hooks the smooth-snake renderer uses
// (useSharedValue/useDerivedValue) AND the one gesture-handler needs
// (useEvent), so both render paths mount. The published
// `react-native-reanimated/mock` entry points at an unbuilt source file in this
// version, hence the explicit lib path.
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/lib/module/mock'),
);

