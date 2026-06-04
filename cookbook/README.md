# osmRouter Cookbook

Short, copy-pasteable recipes for common tasks. Each assumes you've installed
the CLI and exported a token:

```sh
curl -fsSL https://osmrouter.com/install.sh | sh
export OSM_TOKEN=osm_xxxxx
```

## Recipes

- [Share a local dev server](#share-a-local-dev-server)
- [Receive webhooks on localhost](#receive-webhooks-on-localhost)
- [Serve a local LLM (Ollama / vLLM)](#serve-a-local-llm)
- [Use your own domain](#use-your-own-domain)
- [A stable URL across restarts](#a-stable-url-across-restarts)
- [Stream Server-Sent Events](#stream-server-sent-events)
- [Open a tunnel in a test (Node SDK)](#open-a-tunnel-in-a-test)
- [Point at a self-hosted relay](#point-at-a-self-hosted-relay)

---

## Share a local dev server

```sh
osmrouter http 3000
# → https://<random>.osmrouter.com
```

If your framework rejects unknown hosts, allow the tunnel hostname (or disable
the host check in development).

## Receive webhooks on localhost

Pin a subdomain so the provider keeps posting to the same address:

```sh
OSM_SUBDOMAIN=stripe-hooks osmrouter http 4242
# → https://stripe-hooks.osmrouter.com
```

Paste that URL into the provider's webhook settings, then watch deliveries land
in the **Traffic Inspector** (method, path, status, latency, body size).

## Serve a local LLM

Expose an OpenAI-compatible server. Streaming and long requests pass through
with no timeout:

```sh
# Ollama listens on 11434
OSM_SUBDOMAIN=llm osmrouter http 11434
# → https://llm.osmrouter.com/v1/chat/completions
```

Call it (consume the stream as it arrives — note `-N`):

```sh
curl -N https://llm.osmrouter.com/v1/chat/completions \
  -d '{"model":"llama3","messages":[{"role":"user","content":"hi"}],"stream":true}'
```

## Use your own domain

After verifying `example.com` under **Dashboard → Domains**:

```sh
OSM_DOMAIN=example.com OSM_SUBDOMAIN=api osmrouter http 8080
# → https://api.example.com
```

## A stable URL across restarts

```sh
OSM_SUBDOMAIN=my-app osmrouter http 8080
# → https://my-app.osmrouter.com  (same every run)
```

## Stream Server-Sent Events

SSE flows through unbuffered:

```js
const es = new EventSource("https://my-app.osmrouter.com/events");
es.onmessage = (e) => console.log(e.data);
```

## Open a tunnel in a test

See [`../examples/node-sdk/webhook.test.mjs`](../examples/node-sdk/webhook.test.mjs).

## Point at a self-hosted relay

```sh
OSM_RELAY=tunnel.example.com:8443 \
OSM_DOMAIN=example.com \
osmrouter http 8080
```
