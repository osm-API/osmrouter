# Changelog

All notable changes to the osmRouter CLI are documented here.

## v1.0.0 — 2026-06-04

The first public release.

- **HTTP tunnels** — `osmrouter http <port>` exposes a local service at a public
  `https://` URL. Your machine dials out, so it works behind NAT, firewalls, and
  CGNAT with no inbound ports.
- **Random & pinned subdomains** — random by default, or pin one with
  `OSM_SUBDOMAIN`.
- **Custom domains** — serve tunnels on a domain you own via `OSM_DOMAIN`.
- **Streaming** — WebSockets, Server-Sent Events, and chunked bodies pass through
  with no wall-clock timeout.
- **macOS & Linux** — static binaries for `darwin`/`linux` on `amd64`/`arm64`.
- **Node SDK** — `@omsapi/osmrouter` for opening tunnels from code.
