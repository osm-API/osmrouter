# osmRouter Cookbook

Short, copy-pasteable recipes. Each assumes you've installed the CLI and set a
token:

```sh
# macOS / Linux
curl -fsSL https://osmrouter.com/install.sh | sh
export OSM_TOKEN=osm_xxxxx

# Windows (PowerShell)
irm https://osmrouter.com/install.ps1 | iex
$env:OSM_TOKEN = "osm_xxxxx"
```

## Recipes

- [Share a local dev server](#share-a-local-dev-server)
- [Receive webhooks on localhost](#receive-webhooks-on-localhost)
- [Serve a local LLM (Ollama / vLLM)](#serve-a-local-llm)
- [Protect an endpoint with Basic Auth](#protect-an-endpoint-with-basic-auth)
- [Expose a database over TCP](#expose-a-database-over-tcp)
- [Expose SSH over TCP](#expose-ssh-over-tcp)
- [Use your own domain](#use-your-own-domain)
- [A stable URL across restarts](#a-stable-url-across-restarts)
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

Watch deliveries land in the **Traffic Inspector** (method, path, status,
latency, body size).

## Serve a local LLM

Expose an OpenAI-compatible server. Streaming and long requests work with no
timeout:

```sh
OSM_SUBDOMAIN=llm osmrouter http 11434   # Ollama
```

Consume the stream as it arrives (note `-N`):

```sh
curl -N https://llm.osmrouter.com/v1/chat/completions \
  -d '{"model":"llama3","messages":[{"role":"user","content":"hi"}],"stream":true}'
```

## Protect an endpoint with Basic Auth

Gate an HTTP tunnel behind a username and password, enforced at the edge:

```sh
OSM_BASIC_AUTH=alice:s3cret osmrouter http 8080
```

```sh
curl -u alice:s3cret https://<name>.osmrouter.com   # 200
curl https://<name>.osmrouter.com                    # 401
```

## Expose a database over TCP

```sh
osmrouter tcp 5432
# → tunnel.osmrouter.com:10000
```

```sh
psql "host=tunnel.osmrouter.com port=10000 user=postgres"
```

The same works for MySQL (3306), Redis (6379), MongoDB (27017), and any TCP
service.

## Expose SSH over TCP

```sh
osmrouter tcp 22
# → tunnel.osmrouter.com:10001
```

```sh
ssh -p 10001 user@tunnel.osmrouter.com
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

## Open a tunnel in a test

See [`../examples/node-sdk/webhook.test.mjs`](../examples/node-sdk/webhook.test.mjs).

## Point at a self-hosted relay

```sh
OSM_RELAY=tunnel.example.com:8443 \
OSM_DOMAIN=example.com \
OSM_API=https://api.example.com \
osmrouter http 8080
```
