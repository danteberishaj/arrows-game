import * as Application from 'expo-application';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StatusBar, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONSENT_GATE, META_SETTINGS_HOW_TO_PLAY, META_SETTINGS_RATE, META_THEME_SYSTEM } from '../featureFlags';
import { adPrivacyOptionsRequired, openAdPrivacyOptions } from './ads';
import { PressScale, pressSnapTransform } from './PressScale';
import {
  playStoreUrls,
  PRIVACY_POLICY_URL,
  SETTINGS_SCRIM_OPACITY,
  SETTINGS_TITLE,
  SUPPORT_EMAIL,
  settingsRows,
  supportMailto,
  type SettingsRow,
} from './settingsRows';
import { ArrowStyleOptions } from './ArrowStyleOptions';
import { useArrowStyle, skinPickerEnabled } from './useArrowStyle';
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

/** The app's version name (app.json `expo.version`, embedded by expo-constants). */
function appVersion(): string | undefined {
  return Constants.expoConfig?.version;
}

/** The installed build number: the Android versionCode the build actually carries (builds set it after prebuild, so
 * app.json's value would be stale). Owner request 2026-10-01: show it as "Version 1.0.0 (9)". */
function appBuild(): string | null {
  return Application.nativeBuildVersion;
}

/**
 * TF-01 B: the installed package's id (expo-application reads it from the running app: com.danteb.arrows on the Play
 * build), falling back to app.json's `android.package` embedded by expo-constants. Never a second hard-coded string.
 */
function appPackageId(): string | null {
  return Application.applicationId ?? Constants.expoConfig?.android?.package ?? null;
}

/**
 * TF-01 B: opens the Play listing, the Play Store app first (market://) and the web page if nothing handles that.
 * Never the in-app review API (reviewPrompt.ts owns it; Play quota-limits it, so a button could silently do nothing).
 */
function openPlayListing(): void {
  const [market, web] = playStoreUrls(appPackageId());
  if (market === undefined) return;
  Linking.openURL(market).catch(() => {
    if (web !== undefined) openExternal(web);
  });
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
  onHowToPlay,
  themeFollowsSystem = false,
  onThemeFollowsSystemChange,
}: {
  palette: Palette;
  /** The menu's theme: the sheet's window gets the same status-bar icons (see onShow). */
  dark: boolean;
  onClose: () => void;
  /** TF-01 C (META_SETTINGS_HOW_TO_PLAY): the sheet closes, then this starts the tutorial replay. */
  onHowToPlay?: () => void;
  /** TF-01 A (META_THEME_SYSTEM): the Match phone theme switch's state (live, not read once like the rows). */
  themeFollowsSystem?: boolean;
  onThemeFollowsSystemChange?: (on: boolean) => void;
}) {
  const style = useArrowStyle();
  const [styleListOpen, setStyleListOpen] = useState(false);
  const pickerEnabled = skinPickerEnabled();
  const backToSettings = () => setStyleListOpen(false);
  const dismiss = styleListOpen ? backToSettings : onClose;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [rows] = useState<SettingsRow[]>(() =>
    settingsRows({
      consentGate: CONSENT_GATE,
      privacyOptionsRequired: adPrivacyOptionsRequired(),
      policyUrl: PRIVACY_POLICY_URL,
      supportEmail: SUPPORT_EMAIL,
      version: appVersion(),
      build: appBuild(),
      howToPlay: META_SETTINGS_HOW_TO_PLAY,
      themeSystem: META_THEME_SYSTEM,
      rate: META_SETTINGS_RATE,
      platform: Platform.OS,
    }),
  );
  // TF-01 C: How to play stays the sheet's first row, above the arrow-style row too. Flags OFF: `lead` is empty and
  // `rest` is every row, so the sheet renders exactly as before.
  const lead = rows.filter((row) => row.id === 'howToPlay');
  const rest = rows.filter((row) => row.id !== 'howToPlay');

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
      case 'rateArrows':
        openPlayListing();
        return;
      case 'howToPlay':
        // The replay replaces the menu: close the sheet first so its Modal never sits over the board.
        onClose();
        onHowToPlay?.();
        return;
      case 'matchPhoneTheme':
        onThemeFollowsSystemChange?.(!themeFollowsSystem);
        return;
      default:
        return;
    }
  }, [onClose, onHowToPlay, onThemeFollowsSystemChange, themeFollowsSystem]);

  // Android draws the Modal in its own window, which came up with LIGHT status-bar icons over the Daylight scrim
  // (white on white: the clock and icons vanished; `dumpsys window` showed the dialog without LIGHT_STATUS_BARS,
  // artifacts/W7-04/captures/on). RN's StatusBar module re-styles every open Modal window along with the activity,
  // so once the window is up the menu's own style is applied again: dark icons in Daylight, light in Ink Night.
  const onShow = useCallback(() => {
    StatusBar.setBarStyle(dark ? 'light-content' : 'dark-content', false);
  }, [dark]);
  // TF-01 A: with META_THEME_SYSTEM the theme can change while the sheet is open (the Match phone theme switch, or the
  // phone's own setting). Re-style the Modal's window with it, as onShow does at open. Skips the first render (onShow
  // owns that); OFF: `dark` cannot change while the sheet is open, and this never runs.
  const shownDarkRef = useRef(dark);
  useEffect(() => {
    if (!META_THEME_SYSTEM || shownDarkRef.current === dark) return;
    shownDarkRef.current = dark;
    StatusBar.setBarStyle(dark ? 'light-content' : 'dark-content', false);
  }, [dark]);

  const renderRow = (row: SettingsRow) => {
    if (row.kind === 'switch') {
      // TF-01 A: the whole row toggles; the Switch shows the state (hidden from accessibility, the row is the switch).
      return (
        <Pressable
          key={row.id}
          accessibilityRole="switch"
          accessibilityLabel={row.label}
          accessibilityState={{ checked: themeFollowsSystem }}
          onPress={() => onRow(row)}
          style={[styles.row, styles.switchRow, { borderTopColor: p.border }]}
        >
          <Text style={[styles.rowLabel, styles.switchLabel, { color: p.ink }]}>{row.label}</Text>
          <Switch
            value={themeFollowsSystem}
            onValueChange={(on) => onThemeFollowsSystemChange?.(on)}
            trackColor={{ false: p.glyphOff, true: p.accent }}
            thumbColor={p.inkOnAccent}
            ios_backgroundColor={p.glyphOff}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </Pressable>
      );
    }
    return row.pressable ? (
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
    );
  };

  const panelWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, width - 2 * PANEL_SIDE_MARGIN));

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
      onShow={onShow}
    >
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={styleListOpen ? 'Close arrow style' : CLOSE_LABEL}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: p.bg, opacity: SETTINGS_SCRIM_OPACITY }]}
        />
        <View
          testID="settings-panel"
          style={[styles.panel, { width: panelWidth, backgroundColor: p.surface, borderColor: p.border }]}
        >
          <Text accessibilityRole="header" style={[styles.title, { color: p.ink }]}>
            {styleListOpen ? 'Arrow style' : SETTINGS_TITLE}
          </Text>
          {styleListOpen ? <ArrowStyleOptions palette={p} onBack={backToSettings} /> : <>
          {lead.map(renderRow)}
          {pickerEnabled && <Pressable
            accessibilityRole="button"
            accessibilityLabel="Arrow style"
            accessibilityHint={style.name}
            onPress={() => setStyleListOpen(true)}
            style={[styles.row, { borderTopColor: p.border }]}
          >
            <Text style={[styles.rowLabel, { color: p.ink }]}>Arrow style</Text>
            <Text style={[styles.rowDetail, { color: p.inkDim }]}>{style.name}</Text>
          </Pressable>}
          {rest.map(renderRow)}
          </>}
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
  // TF-01 A: label left, switch right.
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: 12, // OWNER-PICKED STARTING VALUE
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
