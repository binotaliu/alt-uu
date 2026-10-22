# Alt UU release pipeline (fastlane)

Driven by `.github/workflows/mobile-release.yml` and the composite action
`.github/actions/setup-expo-build`. Flow per job:
`setup-expo-build` -> (resolve-build-numbers job) `fastlane <platform> sync_build_number` ->
`npx expo prebuild --platform <p> --clean` -> `fastlane <platform> build_* / release`.

Build configuration reaches `app.config.ts` via env vars: `APP_VERSION`,
`APP_BUILD_NUMBER`, `EXPO_PUBLIC_DISPLAY_VERSION`,
`EXPO_PUBLIC_MATERIAL_SOURCE_VIEWER_ENABLED` (set for any non-`x.y.z` display
version, i.e. RC/beta/commit-hash builds).

## Lanes

| Lane                               | What it does                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `ios sync_build_number`            | latest TestFlight/App Store build for this exact version + 1 + `JUMP_BY`       |
| `ios build_ipa`                    | temp keychain, install profile, manual-sign app target, export app-store IPA   |
| `ios upload_ipa` / `ios release`   | upload to App Store Connect (TestFlight) / build + upload                      |
| `android sync_build_number`        | highest versionCode across internal/alpha/beta/production + 1                  |
| `android build_bundle` / `release` | signed AAB via `android-signing.init.gradle` / build + upload to Play internal |
| `android build_sideload`           | signed APK with the sideload keystore (`SIDELOAD_*` env)                       |

Outputs land in `apps/mobile/fastlane/build-output/` (git-ignored).

## Secrets / variables

Existing secrets, reused unchanged:

- `IOS_DISTRIBUTION_CERTIFICATE_P12_BASE64`, `IOS_DISTRIBUTION_PROVISIONING_PROFILE_BASE64`
- `APP_STORE_API_KEY_P8_BASE64`
- `ANDROID_KEYSTORE_BASE64`, `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`
- `ANDROID_SIDELOAD_KEYSTORE_BASE64`, `ANDROID_SIDELOAD_KEYSTORE_PASSWORD`, `ANDROID_SIDELOAD_KEY_ALIAS`
- `ALTUU_PRODUCTION_ENV` - **no longer written to a `.env`**, but still read for the
  scalar settings the legacy pipeline kept inside it (there were no separate
  secrets for them): `APP_STORE_API_KEY_ID`, `APP_STORE_API_ISSUER_ID`,
  `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` (optional),
  `NATIVEPHP_DEVELOPMENT_TEAM` (optional; falls back to the profile's team),
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
  To retire it, replace the `read_setting` step in the action with dedicated secrets.

Optional env: `IOS_CODE_SIGN_IDENTITY` (default `Apple Distribution`; set to
`iPhone Distribution` if the cert is an older one).

Android jobs now run on `ubuntu-latest` (no macOS needed); iOS build on `xcode-27` (Xcode 27.1 selected; macos-26 only has Xcode 26.x).

## One-time setup

1. `cd apps/mobile && bundle install` and commit `Gemfile.lock` (not generated here; CI works without it but it will be unpinned).
2. The `release` GitHub Environment (manual approval) must still exist.

## Dry-run checklist

1. Locally: `cd apps/mobile && npx expo prebuild --platform ios --clean` (and android) succeeds with `APP_VERSION=1.1.0 APP_BUILD_NUMBER=999`.
2. Check the generated project: `ios/*.xcworkspace` exists (scheme name = workspace name), `android/app/build.gradle` has a `release` build type.
3. Manual dispatch on a branch with `publish` unchecked: `build-android`, `build-ios` must produce an `.aab` / `.ipa` artifact.
4. Confirm the AAB is signed by the upload key: `keytool -printcert -jarfile alt-uu.aab` fingerprint matches Play's upload cert.
5. Confirm `android-signing.init.gradle` took effect (not debug-signed) and the iOS profile name/entitlements (IAP) match the bundle id `org.binota.alt-uu`.
6. Dispatch with `publish` checked and `jump_by` empty: check the sync step log (store latest vs. chosen number), approve, verify Play internal + TestFlight receive builds with numbers above the legacy NativePHP builds.
7. Sideload job: `apksigner` cert digest equals `EXPECTED_SHA256` in the workflow; attestation appears; the GitHub release is created.
8. Install an RC build and confirm the material source viewer is enabled; a plain `x.y.z` tag build must not enable it.
9. Known untested risks: `update_code_signing_settings` target name, Play `release_status` for an internal track on a draft app (add `release_status: 'draft'` to `upload_to_play_store` if rejected), and `latest_testflight_build_number` behaviour for a never-uploaded version.
