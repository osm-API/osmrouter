# osmRouter Desktop

A simple desktop app to expose your local ports at public URLs — no terminal
needed.

- Paste your osmRouter **agent token** (the app guides you to get one).
- See every **listening local port** on your machine, live.
- Tunnel any port with one click — **HTTP** (optional subdomain, custom domain,
  or Basic Auth) or **raw TCP**.
- Watch the **public URL, status, and live request log** for each port.

## Download

Grab the latest installer from the
[releases page](https://github.com/osm-API/osmrouter/releases) (`desktop-v*`):

- **macOS (Apple Silicon):** `osmRouter-*-mac-arm64.dmg`
- **macOS (Intel):** `osmRouter-*-mac-intel.dmg`
- **Windows:** `osmRouter Setup *.exe`

The app bundles the `osmrouter` CLI; if the bundled binary doesn't match your
architecture it downloads the correct one on first use.

## Develop

```sh
cd desktop
npm install        # also downloads the osmrouter binary into ./bin
npm start          # launch the app
npm run dist:mac   # build a macOS installer
npm run dist:win   # build a Windows installer
```

## License

MIT
