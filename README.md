<div align="center">

# osmRouter

**Expose any local service at a public HTTPS URL — on a domain you own.**

Run a server on your machine, point osmRouter at its port, and get a live
`https://` URL anyone can reach. Your machine dials out, so it works behind NAT,
firewalls, and CGNAT with **no inbound ports**.

[Website](https://osmrouter.com) · [Docs](https://docs.osmrouter.com) · [Dashboard](https://app.osmrouter.com) · [Status](https://status.osmrouter.com)

</div>

---

This repository contains the **osmRouter CLI**, **SDK examples**, and a
**cookbook** of common recipes. It does not contain the server/relay source.

## Install

macOS or Linux:

```sh
curl -fsSL https://osmrouter.com/install.sh | sh
```

Verify:

```sh
osmrouter version
```

> Windows isn't supported directly yet — use WSL, or the [Node SDK](#node-sdk).

## 60-second quickstart

1. **Create a token.** Sign in at [app.osmrouter.com](https://app.osmrouter.com),
   open **Tokens**, and create one (looks like `osm_xxxxx`).
2. **Export it.**
   ```sh
   export OSM_TOKEN=osm_xxxxx
   ```
3. **Tunnel a local port.**
   ```sh
   osmrouter http 8080
   # → Forwarding https://happy-tiger.osmrouter.com → localhost:8080
   ```

That URL is live on the public internet over HTTPS, immediately.

## Pin a stable URL

By default each run gets a random name. Pin a subdomain so the URL survives
restarts (ideal for webhooks):

```sh
OSM_SUBDOMAIN=my-app osmrouter http 8080
# → https://my-app.osmrouter.com
```

## Commands

| Command | Description |
| --- | --- |
| `osmrouter http <port>` | Expose a local HTTP service at a public HTTPS URL |
| `osmrouter version` | Print the installed version |
| `osmrouter help` | Show usage |

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OSM_TOKEN` | yes | — | Agent token (create one under Tokens) |
| `OSM_SUBDOMAIN` | no | random | Pin a stable subdomain |
| `OSM_DOMAIN` | no | `osmrouter.com` | A verified custom domain to serve under |
| `OSM_RELAY` | no | `tunnel.osmrouter.com:8443` | Relay endpoint (self-hosting only) |

## Node SDK

Open tunnels from code — handy in tests and preview environments:

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

## What flows through a tunnel

Plain HTTP/HTTPS, **WebSockets**, **Server-Sent Events**, and chunked/streaming
bodies — with **no wall-clock timeout**. That makes osmRouter a good fit for
streaming LLM output (Ollama, vLLM, llama-server) and other long-lived
connections, not just short requests.

## Links

- 📚 **Docs:** https://docs.osmrouter.com
- 🧪 **Examples:** [`examples/`](./examples)
- 🍳 **Cookbook:** [`cookbook/`](./cookbook)
- 💬 **Issues:** open one in this repo
- 🏢 **Self-host / Enterprise:** https://osmrouter.com/pricing

## License

MIT — see [LICENSE](./LICENSE).
