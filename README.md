<div align="center">

# osmRouter

**Expose any local service at a public URL — on a domain you own.**

Run a server on your machine, point osmRouter at its port, and get a live
public address anyone can reach. Your machine dials out, so it works behind NAT,
firewalls, and CGNAT with **no inbound ports**.

[Website](https://osmrouter.com) · [Docs](https://docs.osmrouter.com) · [Dashboard](https://app.osmrouter.com) · [Status](https://status.osmrouter.com) · [Changelog](https://docs.osmrouter.com/changelog)

</div>

---

This repository contains the **osmRouter CLI**, **SDK examples**, and a
**cookbook** of common recipes. It does not contain the server/relay source.

## Install

osmRouter ships native binaries for **macOS, Linux, and Windows** on `amd64`
and `arm64`. The installers verify the download's SHA-256 checksum.

**macOS / Linux**

```sh
curl -fsSL https://osmrouter.com/install.sh | sh
```

**Windows** (PowerShell)

```powershell
irm https://osmrouter.com/install.ps1 | iex
```

Verify:

```sh
osmrouter version
```

> Prefer a package? `npm install @omsapi/osmrouter` ships the same binary for all
> three OSes — see [Node SDK](#node-sdk).

## 60-second quickstart

1. **Create a token.** Sign in at [app.osmrouter.com](https://app.osmrouter.com),
   open **Tokens**, and create one (looks like `osm_xxxxx`).
2. **Export it.**
   ```sh
   export OSM_TOKEN=osm_xxxxx            # macOS / Linux
   $env:OSM_TOKEN = "osm_xxxxx"          # Windows PowerShell
   ```
3. **Tunnel a local port.**
   ```sh
   osmrouter http 8080
   # → Forwarding https://happy-tiger.osmrouter.com → localhost:8080
   ```

## Commands

| Command | Description |
| --- | --- |
| `osmrouter http <port>` | Expose a local HTTP service at a public HTTPS URL |
| `osmrouter tcp <port>` | Expose a raw TCP service at `tunnel.<domain>:<port>` |
| `osmrouter version` | Print the installed version |
| `osmrouter help` | Show usage |

## HTTP tunnels

```sh
osmrouter http 8080
# → https://<random>.osmrouter.com
```

**Pin a stable URL** (great for webhooks):

```sh
OSM_SUBDOMAIN=my-app osmrouter http 8080
# → https://my-app.osmrouter.com
```

**Protect with Basic Auth** — a username/password gate enforced at the edge:

```sh
OSM_BASIC_AUTH=alice:s3cret osmrouter http 8080
# visitors without valid credentials get a 401
```

WebSockets, Server-Sent Events, and chunked/streaming bodies pass through with
**no wall-clock timeout** — good for streaming LLMs (Ollama, vLLM, llama-server).

## TCP tunnels

Expose a raw TCP service — a database, SSH, a game server — at a public
`tunnel.<domain>:<port>`. The port is allocated for you:

```sh
osmrouter tcp 5432
# → tunnel.osmrouter.com:10000  ->  localhost:5432
```

Connect like any TCP endpoint:

```sh
psql "host=tunnel.osmrouter.com port=10000 user=postgres"
```

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OSM_TOKEN` | yes | — | Agent token (create one under Tokens) |
| `OSM_SUBDOMAIN` | no | random | Pin a stable subdomain (http only) |
| `OSM_BASIC_AUTH` | no | — | Protect an HTTP tunnel, as `user:pass` |
| `OSM_DOMAIN` | no | `osmrouter.com` | A verified custom domain to serve under |
| `OSM_API` | no | `https://api.<domain>` | Control-plane API (tcp port allocation) |
| `OSM_RELAY` | no | `tunnel.osmrouter.com:8443` | Relay endpoint (self-hosting only) |

## Node SDK

Open tunnels from code — handy in tests and preview environments. Works on
macOS, Linux, and Windows:

```sh
npm install @omsapi/osmrouter
```

```ts
import { connect } from "@omsapi/osmrouter";

const tunnel = await connect({ port: 8080, token: process.env.OSM_TOKEN });
console.log(tunnel.url); // https://<name>.osmrouter.com
await tunnel.close();
```

See [`examples/`](./examples) and the [`cookbook/`](./cookbook) for more.

## Links

- 📚 **Docs:** https://docs.osmrouter.com
- 🧪 **Examples:** [`examples/`](./examples)
- 🍳 **Cookbook:** [`cookbook/`](./cookbook)
- 🗒️ **Changelog:** [`CHANGELOG.md`](./CHANGELOG.md)
- 🏢 **Self-host / Enterprise:** https://osmrouter.com/pricing
- 📧 **Contact:** contact@osmapi.com

## License

MIT — see [LICENSE](./LICENSE).
