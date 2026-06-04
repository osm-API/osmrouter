# CLI examples

Install once:

```sh
curl -fsSL https://osmrouter.com/install.sh | sh
export OSM_TOKEN=osm_xxxxx
```

### Expose a dev server

```sh
osmrouter http 3000
```

### Stable URL for webhooks

```sh
OSM_SUBDOMAIN=stripe-hooks osmrouter http 4242
```

### Serve a local LLM (streaming, no timeout)

```sh
OSM_SUBDOMAIN=llm osmrouter http 11434
```

### Use a verified custom domain

```sh
OSM_DOMAIN=example.com OSM_SUBDOMAIN=api osmrouter http 8080
```

### Run a quick static site

```sh
# serve the current directory, then tunnel it
python3 -m http.server 8000 &
osmrouter http 8000
```

See the [cookbook](../../cookbook) for more.
