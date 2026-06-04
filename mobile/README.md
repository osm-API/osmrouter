# osmRouter for Android

Expose a port running on your phone (a local web server, an on-device LLM, …)
at a public URL — no terminal needed.

- Paste your osmRouter agent token.
- Enter the local port, pick **HTTP** (with optional subdomain / Basic Auth) or
  **TCP**, and start the tunnel.
- The tunnel runs as a foreground service; watch the public URL, status, and
  live request log.

## Download

Grab the APK from the [releases page](https://github.com/osm-API/osmrouter/releases)
(`mobile-v*` → `osmRouter-*-android.apk`). Enable “install from unknown sources”
to install it.

## How it works

A React Native (Expo) app with a small Kotlin module that runs the bundled
`osmrouter` Android binary (arm64) as a foreground service and streams its
output. Built in CI (`.github/workflows/mobile.yml`).

## Develop

```sh
cd mobile
npm install
npx expo prebuild --platform android
# place the binary, then:
cd android && ./gradlew assembleRelease
```
