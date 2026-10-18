# End-to-end flows (Maestro)

[Maestro](https://maestro.mobile.dev) flows that replace the legacy Pest browser tests (`tests/Browser` in the Laravel app). They drive a real build on a simulator / emulator against the real HUNGU and school portal services, so they need real student accounts.

| Flow                   | Covers                                                       | Legacy test                                     |
| ---------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `login.yaml`           | onboarding, login, account tab shows the profile             | `Auth/OnboardingPageTest`, `Auth/LoginPageTest` |
| `course-material.yaml` | course list → course → first material of the directory       | `Courses/CoursesTest`, `Courses/MaterialTest`   |
| `discuss-thread.yaml`  | course 討論 tab → first board → first topic → posts          | `Courses/DiscussBoardTest`, `DiscussThreadTest` |
| `switch-account.yaml`  | add a second account, switch back to the first               | `Account/AccountsTest`                          |
| `session-expiry.yaml`  | remembered password rejected → re-authenticate → course list | `Auth/SessionExpiredTest`                       |
| `subflows/*.yaml`      | building blocks (`fresh-login`, `open-first-course`)         |                                                 |

Every flow starts from a fresh install (`clearState` + `clearKeychain`), so they can run in any order.

## Environment

Maestro passes shell variables prefixed with `MAESTRO_` to the flows automatically (or use `-e NAME=value`).

| Variable             | Used by               | Value                                                |
| -------------------- | --------------------- | ---------------------------------------------------- |
| `MAESTRO_APP_ID`     | all                   | iOS `org.binota.alt-uu`, Android `org.binota.alt_uu` |
| `MAESTRO_USERNAME`   | all                   | 學號 / account of a real student                     |
| `MAESTRO_PASSWORD`   | all                   | its password                                         |
| `MAESTRO_USERNAME_2` | `switch-account.yaml` | a second, different account                          |
| `MAESTRO_PASSWORD_2` | `switch-account.yaml` | its password                                         |

`discuss-thread.yaml` needs the first course of `MAESTRO_USERNAME` to have a discussion board with at least one topic; `course-material.yaml` needs a course with at least one material.

Never commit credentials. Keep them in your shell (for example a git-ignored `.env.e2e` you `source`) or in CI secrets.

## Running

Device builds are run by you, not by agents. From `apps/mobile`:

```sh
npx expo run:ios            # or: npx expo run:android  (debug build, installs the app)
export MAESTRO_APP_ID=org.binota.alt-uu   # Android: org.binota.alt_uu
export MAESTRO_USERNAME=... MAESTRO_PASSWORD=... MAESTRO_USERNAME_2=... MAESTRO_PASSWORD_2=...
maestro test e2e                    # every flow, in the order of e2e/config.yaml
maestro test e2e/login.yaml         # one flow
```

`session-expiry.yaml` opens `altuu://dev/expire-session`, a dev-only route (`apps/mobile/src/app/dev/expire-session.tsx`) that drops the active account's HUNGU session and replaces its remembered password so the next HUNGU call fails the remembered re-login. It redirects to `/` in release builds, so run that flow against a debug build.

## Selectors

Flows select elements by `testID` (Maestro `id`), never by layout. When you change a screen, keep these IDs:

- Auth: `onboarding-continue`, `login-username`, `login-password`, `login-submit`, `reauth-password`, `reauth-submit`, `session-expired-reauth`
- Shell: `tab-index`, `tab-live-sessions`, `tab-school-calendar`, `tab-account`, `account-switcher`
- Courses: `course-row`, `course-tab-<tab>` (`materials`, `discuss`, `homework`, `self-exam`, `grades`, `course-info`), `material-folder`, `material-node`, `material-screen`
- Discuss: `discuss-board-row`, `discuss-node-row`, `discuss-thread`
- Accounts: `account-manage-accounts`, `account-row-<username>`, `account-switch`, `add-account-open`, `add-account-username`, `add-account-password`, `add-account-submit`
- Dev: `dev-expire-session`

The YAML is validated by parsing only (no device in CI); run the flows on a simulator before relying on a change.
