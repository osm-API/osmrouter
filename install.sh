#!/bin/sh
# osmRouter CLI installer.  Usage:  curl -fsSL https://osmrouter.com/install.sh | sh
set -e

REPO="${OSM_REPO:-osm-API/osmrouter}"
BINDIR="${OSM_BINDIR:-/usr/local/bin}"

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
	x86_64 | amd64) ARCH=amd64 ;;
	aarch64 | arm64) ARCH=arm64 ;;
	*)
		echo "Unsupported architecture: $ARCH" >&2
		exit 1
		;;
esac

case "$OS" in
	linux | darwin) ;;
	*)
		echo "Unsupported OS: $OS (Windows: use WSL or the Node SDK)" >&2
		exit 1
		;;
esac

URL="https://github.com/${REPO}/releases/latest/download/osmrouter-${OS}-${ARCH}"
echo "Downloading osmRouter for ${OS}/${ARCH}…"

TMP=$(mktemp)
curl -fsSL "$URL" -o "$TMP"
chmod +x "$TMP"

if [ -w "$BINDIR" ]; then
	mv "$TMP" "$BINDIR/osmrouter"
else
	echo "Installing to $BINDIR (needs sudo)…"
	sudo mv "$TMP" "$BINDIR/osmrouter"
fi

echo "Installed: $(command -v osmrouter)"
echo
echo "Next:"
echo "  1. Create a token at https://app.osmrouter.com (Tokens)"
echo "  2. export OSM_TOKEN=osm_xxxxx"
echo "  3. osmrouter http 8080"
