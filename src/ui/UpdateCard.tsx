import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { linkPressedStyle, PressScale, pressSnapTransform } from './PressScale';
import { Type, type Palette } from './theme';
import { BUDDY } from './Wordmark';

/**
 * UPDATE-PROMPT: the "New version ready" card. A native Modal (Android back = Later, screen readers stay inside,
 * fade is the OS's own), so nothing here depends on an animation finishing to become visible.
 */
export function UpdateCard({ palette: p, onUpdate, onLater }: { palette: Palette; onUpdate: () => void; onLater: () => void }) {
  return <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onLater}>
    <View style={[styles.scrim, { backgroundColor: p.scrimLost }]}>
      <View testID="update-card" accessibilityViewIsModal style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Image source={BUDDY} style={styles.buddy} accessibilityIgnoresInvertColors accessible={false} />
        <Text accessibilityRole="header" style={[styles.title, { color: p.ink }]}>New version ready!</Text>
        <Text style={[styles.sub, { color: p.inkDim }]}>Update for the newest boards and fixes. It downloads while you play.</Text>
        <PressScale testID="update-now" accessibilityRole="button" accessibilityLabel="Update" onPress={onUpdate}
          style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? p.accentDeep : p.accent, transform: pressSnapTransform(pressed) }]}>
          <Text style={[styles.button, { color: p.inkOnAccent }]}>Update</Text>
        </PressScale>
        <Pressable testID="update-later" accessibilityRole="button" accessibilityLabel="Later" onPress={onLater}
          style={({ pressed }) => [styles.secondary, linkPressedStyle(pressed)]}>
          <Text style={[styles.sub, { color: p.inkDim }]}>Later</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

/**
 * Shown on the menu once Play has the update downloaded; tapping installs it (Play restarts the app). Top-left, level
 * with the header buttons (HomeScreen HEADER_TOP 14): never near the banner ad, whose neighbours get accidental taps.
 */
export function RestartChip({ palette: p, onRestart }: { palette: Palette; onRestart: () => void }) {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="box-none" style={[styles.chipRow, { top: insets.top + 14 }]}>
    <PressScale testID="update-restart" accessibilityRole="button" accessibilityLabel="Update ready. Restart to install" onPress={onRestart}
      hitSlop={8} style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? p.accentDeep : p.accent, transform: pressSnapTransform(pressed) }]}>
      <Text style={[styles.chipText, { color: p.inkOnAccent }]}>↻  Update ready</Text>
    </PressScale>
  </View>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 28, borderWidth: 1, padding: 24, alignItems: 'stretch', gap: 12 },
  buddy: { width: 112, height: 112, alignSelf: 'center' },
  title: { ...Type.panelTitle, textAlign: 'center' },
  sub: { ...Type.panelSub, textAlign: 'center' },
  primary: { minHeight: 52, borderRadius: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  button: { ...Type.panelButton, textAlign: 'center' },
  secondary: { minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  chipRow: { position: 'absolute', left: 16 },
  chip: { minHeight: 44, borderRadius: 22, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  chipText: { ...Type.menuStats },
});
