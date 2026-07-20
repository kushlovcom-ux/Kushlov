# Kushlov Mobile

Expo React Native app for Kushlov (`apps/mobile`). Dark-first UI, React Query, Socket.IO, Expo Router-style React Navigation stacks.

## Prerequisites

- Node 20+
- Expo CLI (`npx expo`)
- EAS CLI for store builds (`npm i -g eas-cli`)
- Android Studio / Xcode for local native builds
- Backend API reachable (default: `https://kushlov-server.vercel.app/api`)

## Setup

```bash
cd apps/mobile
cp .env.example .env
npm install
```

Fill `.env` (see `.env.example`):

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL`
- `EXPO_PUBLIC_SITE_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (optional Google sign-in)
- `EXPO_PUBLIC_EAS_PROJECT_ID` (push + EAS)

## Run (Expo Go / Dev Client)

```bash
npm start          # Metro
npm run android    # Android
npm run ios        # iOS
```

**Expo Go limits:** LiveKit (`@livekit/react-native`) and Razorpay need a **custom native build**. In Expo Go the app still runs — calls/live show a graceful fallback UI, and payments explain that a preview APK is required.

For full media + payments:

```bash
npx expo prebuild
npx expo run:android
# or
eas build -p android --profile development
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Start Metro |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prebuild` | Generate native projects |
| `npm run build:apk` | EAS Android preview APK |
| `npm run build:aab` | EAS Android production AAB |
| `npm run build:ios` | EAS iOS production |

## Build & publish checklist

### Preview APK (internal testing)

1. [ ] `eas login` and link project (`eas init` if needed)
2. [ ] Set `EXPO_PUBLIC_*` secrets in EAS or `eas.json` env
3. [ ] `npm run build:apk`
4. [ ] Install APK on device; smoke-test login, discover, chat, wallet UI
5. [ ] Confirm LiveKit/Razorpay modules load (not Expo Go)

### Production Android (Play Store)

1. [ ] Bump `version` / `android.versionCode` in `app.config.ts`
2. [ ] `npm run typecheck`
3. [ ] `npm run build:aab`
4. [ ] Upload AAB to Play Console → Internal testing → Production
5. [ ] Verify deep links: `https://www.klproind.com/*` and `kushlov://`

### Production iOS (App Store)

1. [ ] Apple Developer account + App Store Connect app (`com.kushlov.app`)
2. [ ] Configure certificates via EAS credentials
3. [ ] `npm run build:ios`
4. [ ] Submit with `eas submit -p ios` or Transporter
5. [ ] Confirm camera/mic/location privacy strings match App Review usage

### Push notifications

1. [ ] EAS project ID set
2. [ ] Run on physical device (not Expo Go web)
3. [ ] Grant notification permission; token registered from `src/services/notifications.ts`

### Go-live smoke test

- [ ] Register / login / logout
- [ ] Onboarding only once
- [ ] Discover + public profile + like/match
- [ ] Open chat, send message (socket + REST)
- [ ] Incoming/outgoing call UI (media in native build)
- [ ] Live list + join room (chat/like without LiveKit)
- [ ] Wallet packages (Razorpay in native build)
- [ ] Notifications list + mark read
- [ ] Location save
- [ ] Block / unblock
- [ ] Become host basic verification submit
- [ ] Contact form

## Architecture map

```
src/
  api/           Axios client + domain APIs
  components/    UI, common, chat, calls
  constants/     queryKeys, routes, storageKeys
  hooks/         theme, auth bootstrap, presence, debounce
  navigation/    Root / Auth / Tabs + linking
  providers/     Query, socket, nav theme
  screens/       All production screens
  services/      socket, notifications, razorpay, google-auth
  store/         zustand auth / theme / call
  theme/         colors, spacing, typography
  types/         shared DTOs
```

Brand: pink `#ec4899`, purple `#8b5cf6`, orange `#f97316`, bg `#0a0a0b`.
