# Privacy Policy — Arrows

_Last updated: September 26, 2026_

**DRAFT — NOT LEGAL ADVICE. This text has not been legally reviewed and must not be published
until the owner's legal review (W7-07) removes this line.**

<!--
  Canonical source. docs/privacy-policy.html is GENERATED from this file:
    node scripts/generate-privacy-policy.js
  Never edit the HTML by hand. HTML comments like this one are dropped from the page.
  Every factual sentence about data ends with an evidence tag (an HTML comment holding
  "ev:" and a row id) naming a row in docs/data-safety.md (W7-06). Each statement is true of
  the flags-default build; text that becomes true only when a flag ships waits in the
  "Pending" list of docs/data-safety.md.
-->

**Arrows** ("the app") is a calm game published by Dante Berishaj ("we", "us"). This policy
explains what data the app handles. It covers the Android app.

## Data the app stores on your device

Your game progress (your current level, lifetime stats and streaks), your settings (sound and
theme) and a few counters the game needs (for example, how many levels have passed since the
last ad) are stored on your device. <!-- ev: ev-16 -->
The app also stores a random number generated on your device and counts of app launches and app
errors; in this version of the app they are not sent anywhere. <!-- ev: ev-17 --> <!-- ev: ev-12 -->

The app itself sends none of this data to us or to anyone else, and we cannot see it.
<!-- ev: ev-12 -->
The app has no accounts, no sign-in and no in-app purchases. <!-- ev: ev-20 -->

## Android backup

If backup is turned on for your device, Android can copy the app's stored data to the backup in
your Google account, and restore it when you reinstall the app or set up a new device.
<!-- ev: ev-15 -->
We cannot see or access that backup. <!-- ev: ev-15 -->
You control it in your Android settings and your Google account. <!-- ev: ev-15 -->

Clearing the app's storage in Android settings, or uninstalling the app, deletes the data on your
device. <!-- ev: ev-16 -->
A copy in your Google account's backup follows Google's backup rules until you delete it there.
<!-- ev: ev-15 -->

## Advertising

The app shows ads: an interstitial ad between some levels, and rewarded ads that you can choose
to watch for a hint or to continue a level. <!-- ev: ev-01 -->
The ads are served by **Google AdMob** through the Google Mobile Ads SDK; the app contains no
other ad network or mediation service. <!-- ev: ev-01 -->

To show, measure and protect ads, Google's SDK collects the following from your device and sends
it to Google, encrypted in transit: <!-- ev: ev-01 -->

- your IP address, which may be used to estimate your approximate location <!-- ev: ev-01 -->
- identifiers of your device: the Android advertising ID and the app set ID <!-- ev: ev-04 --> <!-- ev: ev-05 -->
- how you interact with the app and its ads, such as app launches, taps and ad views
  <!-- ev: ev-02 -->
- diagnostic information about how the app and the SDK perform <!-- ev: ev-03 -->

On Android versions that support them, the SDK can also use Android's own advertising features
(the Privacy Sandbox, for example Topics and attribution reporting). <!-- ev: ev-06 -->
Google uses this data for advertising, which can include personalised ads, for measurement and
analytics, and to prevent fraud, under Google's own policies: <!-- ev: ev-01 -->

- Google Privacy Policy: <https://policies.google.com/privacy>
- How Google uses information from apps that use its services:
  <https://policies.google.com/technologies/partner-sites>

We do not receive this data from the app. <!-- ev: ev-12 -->

You can reset or delete your advertising ID, or opt out of personalised ads, in your Android
settings (for example Settings → Privacy → Ads; the wording differs between devices).
<!-- ev: ev-04 -->

## Lawful basis

This section applies where the GDPR or a similar law applies, for example in the European
Economic Area, the United Kingdom and Switzerland.

- **Data stored on your device:** we never receive it, so we need no lawful basis to process it;
  the app stores it only so the game works. <!-- ev: ev-16 --> <!-- ev: ev-12 -->
- **Advertising:** where the law requires consent for the advertising processing described
  above, such as personalised ads, consent is the required basis. This version of the app does
  not show a consent message. <!-- ev: ev-08 -->

<!--
  DRAFT NOTE (dropped from the page): the last sentence is true of the flags-default build and
  is the gap recorded in docs/data-safety.md section 10.1. It must be resolved (pending item
  P-1: publish the AdMob GDPR message and ship CONSENT_GATE with the privacy-options entry)
  before this policy is published. Do not replace it with a consent claim the build lacks.
-->

## Retention

- **On your device:** until you clear the app's storage or uninstall the app. <!-- ev: ev-16 -->
- **Android backup:** under Google's backup rules and your backup settings. <!-- ev: ev-15 -->
- **Advertising data:** kept by Google under Google's policies (linked above); we hold no copy.
  <!-- ev: ev-01 --> <!-- ev: ev-12 -->

## Your rights

Depending on where you live (for example under the GDPR, or a US state privacy law), you may have
the right to access, correct, delete or port your personal data, to object to or restrict its
processing, to withdraw consent, and to complain to your data protection authority.

- We hold no personal data about you, and we cannot link the app on your device to you: there are
  no accounts, and the app sends us nothing. <!-- ev: ev-20 --> <!-- ev: ev-12 -->
  So we cannot look up, correct or delete data about you ourselves. <!-- ev: ev-12 -->
- You can delete the data on your device at any time by clearing the app's storage or
  uninstalling the app. <!-- ev: ev-16 -->
- For the advertising data Google holds, use the advertising ID settings above and the tools
  described in Google's Privacy Policy. <!-- ev: ev-04 -->
- To exercise a right, or with any question, email us at the address under Contact.

## Do Not Sell or Share (US state privacy laws)

Some US state laws, for example California's, may treat personalised advertising through Google
as "selling" or "sharing" personal information. <!-- ev: ev-01 -->
You can opt out in two ways:

- **On your device:** delete or reset your advertising ID, or opt out of personalised ads, in your
  Android settings (see Advertising). Google's SDK reads these settings on your device.
  <!-- ev: ev-04 -->
- **By email:** write to the address under Contact with "Do Not Sell or Share" in the subject.
  Because the app has no accounts and sends us nothing, we cannot identify your device, so we
  will reply with the on-device steps above. <!-- ev: ev-20 --> <!-- ev: ev-12 -->

## Children

The app is not directed at children under 13, and we do not knowingly collect personal
information from them. <!-- ev: ev-20 --> <!-- ev: ev-12 -->
The app does not ask for your age. <!-- ev: ev-20 -->

## Advertising partners

- **Google AdMob** (Google) is the only advertising partner in the app. <!-- ev: ev-01 -->
  Google Privacy Policy: <https://policies.google.com/privacy>

## Changes

If this policy changes, the updated version will be published at the same address with a new
"last updated" date.

## Contact

Questions about this policy or your data:
[techsnaxx@gmail.com](mailto:techsnaxx@gmail.com)
