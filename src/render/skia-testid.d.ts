/**
 * Allow `testID` on Skia drawing nodes.
 *
 * Skia elements paint into a canvas and expose nothing queryable, so the only
 * way a test can assert "this sprite was drawn, at this size" is for the node
 * to carry an identifier that the jest stub (jest.setup.js) forwards onto its
 * stand-in View. Spying on the module export cannot work: a component captures
 * its own import binding at module load, long before a spy is installed.
 *
 * `DrawingNodeProps` is the shared base of every drawing node (Rect, Image,
 * Circle, Path, …), so this single augmentation covers them all. At runtime
 * Skia simply ignores the unknown prop.
 */
import '@shopify/react-native-skia';

declare module '@shopify/react-native-skia' {
  interface DrawingNodeProps {
    /** Test-only handle; ignored by the real Skia renderer. */
    testID?: string;
  }
}
