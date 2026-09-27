import Constants from 'expo-constants';
import React, { useCallback, useState } from 'react';
import { Linking, Modal, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONSENT_GATE } from '../featureFlags';
import { adPrivacyOptionsRequired, openAdPrivacyOptions } from './ads';
import { PressScale, pressSnapTransform } from './PressScale';
import {
  PRIVACY_POLICY_URL,
  SETTINGS_SCRIM_OPACITY,
  SETTINGS_TITLE,
  SUPPORT_EMAIL,
  settingsRows,
  supportMailto,
  type SettingsRow,
} from './settingsRows';
import { Palette, Type } from './theme';

/** The accessible name of the scrim (a tap outside the panel closes the sheet). OWNER-PICKED STARTING VALUE (copy). */
const CLOSE_LABEL = 'Close settings'; // OWNER-PICKED STARTING VALUE
/** The panel's width: the win / lose panel's 280 dp minimum, up to 320, and a 24 dp side margin on a small phone. */
const PANEL_MIN_WIDTH = 280; // OWNER-PICKED STARTING VALUE (the win / lose panel's minWidth)
const PANEL_MAX_WIDTH = 320; // OWNER-PICKED STARTING VALUE
const PANEL_SIDE_MARGIN = 24; // OWNER-PICKED STARTING VALUE
/** An action row's height: above the 44 dp tap-target floor, so a two-line row (Support + address) still fits. */
const ROW_MIN_HEIGHT = 52; // OWNER-PICKED STARTING VALUE
const INFO_ROW_MIN_HEIGHT = 44; // OWNER-PICKED STARTING VALUE (the tap-target floor, though it is not a button)

/** The app's version name (app.json `expo.version`, embedded by expo-constants). The native build number would need
 * expo-application, which the brief rules out, so only the name shows. */
function appVersion(): string | undefined {
  return Constants.expoConfig?.version;
}

/** Opens a URL in the OS (browser, mail app); a device with nothing to handle it does nothing. */
function openExternal(url: string): void {
  Linking.openURL(url).catch(() => {
    // No browser or mail app: the support address stays readable on the row.
  });
}

/**
 * W7-04 (META_SETTINGS_SHEET): the menu's Settings sheet. A transparent `Modal` with no animation (W2 owns panel
 * motion): a `bg` scrim over the menu (a tap on it closes the sheet, as does Android back) and a centred panel in the
 * win / lose panel's shape: the `Settings` title and the rows from settingsRows.ts (privacy policy, ad privacy
 * choices, support, version). Rows are read once when the sheet opens. Colours are palette roles only: `surface`,
 * `border`, `ink`, `inkDim`, and `bg` for the scrim. Every size is a Type token (W5-08).
 */
export function SettingsSheet({
  palette: p,
  dark,
  onClose,
}: {
  palette: Palette;
  /** The menu's theme: the sheet's window gets the same status-bar icons (see onShow). */
  dark: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [rows] = useState<SettingsRow[]>(() =>
    settingsRows({
      consentGate: CONSENT_GATE,
      privacyOptionsRequired: adPrivacyOptionsRequired(),
      policyUrl: PRIVACY_POLICY_URL,
      supportEmail: SUPPORT_EMAIL,
      version: appVersion(),
    }),
  );

  const onRow = useCallback((row: SettingsRow) => {
    switch (row.id) {
      case 'privacyPolicy':
        openExternal(PRIVACY_POLICY_URL);
        return;
      case 'support':
        openExternal(supportMailto(SUPPORT_EMAIL));
        return;
      case 'adPrivacy':
        // UMP's form is its own dialog: close the sheet first so it can never sit under this Modal.
        onClose();
        openAdPrivacyOptions().catch(() => {});
        return;
      default:
        return;
    }
  }, [onClose]);

  // Android draws the Modal in its own window, which came up with LIGHT status-bar icons over the Daylight scrim
  // (white on white: the clock and icons vanished; `dumpsys window` showed the dialog without LIGHT_STATUS_BARS,
  // artifacts/W7-04/captures/on). RN's StatusBar module re-styles every open Modal window along with the activity,
  // so once the window is up the menu's own style is applied again: dark icons in Daylight, light in Ink Night.
  const onShow = useCallback(() => {
    StatusBar.setBarStyle(dark ? 'light-content' : 'dark-content', false);
  }, [dark]);

  const panelWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, width - 2 * PANEL_SIDE_MARGIN));

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onShow={onShow}
    >
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CLOSE_LABEL}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: p.bg, opacity: SETTINGS_SCRIM_OPACITY }]}
        />
        <View
          testID="settings-panel"
          style={[styles.panel, { width: panelWidth, backgroundColor: p.surface, borderColor: p.border }]}
        >
          <Text accessibilityRole="header" style={[styles.title, { color: p.ink }]}>
            {SETTINGS_TITLE}
          </Text>
          {rows.map((row) =>
            row.pressable ? (
              <PressScale
                key={row.id}
                accessibilityRole={row.id === 'privacyPolicy' ? 'link' : 'button'}
                accessibilityLabel={row.label}
                accessibilityHint={row.detail}
                onPress={() => onRow(row)}
                style={({ pressed }) => [
                  styles.row,
                  { borderTopColor: p.border, transform: pressSnapTransform(pressed) },
                ]}
              >
                <Text style={[styles.rowLabel, { color: p.ink }]}>{row.label}</Text>
                {row.detail !== undefined && (
                  <Text style={[styles.rowDetail, { color: p.inkDim }]}>{row.detail}</Text>
                )}
              </PressScale>
            ) : (
              <View key={row.id} style={[styles.infoRow, { borderTopColor: p.border }]}>
                <Text style={[styles.info, { color: p.inkDim }]}>{row.label}</Text>
              </View>
            ),
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The win / lose panel's corner and hairline (GameScreen styles.panel); the rows run edge to edge inside it.
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  title: {
    ...Type.panelTitle,
    textAlign: 'center',
    marginTop: 22, // OWNER-PICKED STARTING VALUE
    marginBottom: 14, // OWNER-PICKED STARTING VALUE
  },
  row: {
    alignSelf: 'stretch',
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: 24, // OWNER-PICKED STARTING VALUE
    paddingVertical: 8, // OWNER-PICKED STARTING VALUE
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  // The entry-row controls' type (Today's board, Gallery): the menu's quiet text-control size.
  rowLabel: {
    ...Type.menuEntry,
  },
  // The stats line's type.
  rowDetail: {
    ...Type.menuStats,
    marginTop: 2, // OWNER-PICKED STARTING VALUE
  },
  infoRow: {
    alignSelf: 'stretch',
    minHeight: INFO_ROW_MIN_HEIGHT,
    paddingHorizontal: 24, // OWNER-PICKED STARTING VALUE
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  info: {
    ...Type.menuStats,
  },
});
