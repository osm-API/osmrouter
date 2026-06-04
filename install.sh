#!/bin/sh
# osmRouter CLI installer.  Usage:  curl -fsSL https://osmrouter.com/install.sh | sh
#
# macOS and Linux (amd64/arm64). On Windows, use PowerShell instead:
#   irm https://osmrouter.com/install.ps1 | iex
#
# Knobs (env): OSM_REPO, OSM_BINDIR, OSM_VERSION (default: newest vX.Y.Z),
#              OSM_NO_VERIFY=1 to skip checksum verification.
set -eu

REPO="${OSM_REPO:-osm-API/osmrouter}"
BINDIR="${OSM_BINDIR:-/usr/local/bin}"
VERSION="${OSM_VERSION:-}"

err() { echo "osmRouter: $*" >&2; }

# --- temp file with guaranteed cleanup -------------------------------------
TMP=$(mktemp 2>/dev/null || echo "/tmp/osmrouter.$$")
SUMS=""
cleanup() { rm -f "$TMP" "$SUMS" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# --- detect platform -------------------------------------------------------
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
	x86_64 | amd64) ARCH=amd64 ;;
	aarch64 | arm64) ARCH=arm64 ;;
	armv7* | armv6* | arm)
		err "32-bit ARM is not supported yet (need arm64). Use the Node SDK: npm i @omsapi/osmrouter"
		exit 1
		;;
	*)
		err "unsupported architecture: $ARCH (need x86_64 or arm64)"
		exit 1
		;;
esac

case "$OS" in
	linux | darwin) ;;
	mingw* | msys* | cygwin* | windows*)
		err "this script is for macOS/Linux. On Windows run in PowerShell:"
		err "  irm https://osmrouter.com/install.ps1 | iex"
		err "...or use WSL, or the Node SDK:  npm i @omsapi/osmrouter"
		exit 1
		;;
	*)
		err "unsupported OS: $OS"
		exit 1
		;;
esac

ASSET="osmrouter-${OS}-${ARCH}"
# --- resolve the CLI version --------------------------------------------------
# The newest CLI release (tag vX.Y.Z). We resolve it explicitly via the API and
# do NOT use /releases/latest — that pointer is shared with the desktop app's
# `desktop-v*` releases, which don't contain CLI binaries.
http_get() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$1" 2>/dev/null
	elif command -v wget >/dev/null 2>&1; then
		wget -qO- "$1" 2>/dev/null
	fi
}
if [ -z "$VERSION" ]; then
	VERSION=$(http_get "https://api.github.com/repos/${REPO}/releases?per_page=30" |
		grep -oE '"tag_name": *"v[0-9]+\.[0-9]+\.[0-9]+"' |
		head -n 1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+')
fi
# Fallback if the API is unreachable (rate-limited, offline).
[ -z "$VERSION" ] && VERSION="v1.2.0"
BASE="https://github.com/${REPO}/releases/download/${VERSION}"

# --- choose a downloader ---------------------------------------------------
download() { # download <url> <dest>
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$1" -o "$2"
	elif command -v wget >/dev/null 2>&1; then
		wget -q "$1" -O "$2"
	else
		err "need curl or wget installed."
		exit 1
	fi
}

echo "Downloading osmRouter (${OS}/${ARCH})…"
if ! download "${BASE}/${ASSET}" "$TMP"; then
	err "download failed from ${BASE}/${ASSET}"
	err "see https://github.com/${REPO}/releases for available builds."
	exit 1
fi

# --- sanity: a real binary is well over 1 MB (catches HTML error pages) -----
SIZE=$(wc -c < "$TMP" 2>/dev/null | tr -d ' ')
if [ "${SIZE:-0}" -lt 1000000 ]; then
	err "downloaded file looks wrong (${SIZE:-0} bytes) — aborting."
	err "the release asset may be missing; check https://github.com/${REPO}/releases"
	exit 1
fi

# --- verify checksum (best-effort) -----------------------------------------
if [ "${OSM_NO_VERIFY:-}" != "1" ]; then
	SHACMD=""
	if command -v sha256sum >/dev/null 2>&1; then SHACMD="sha256sum"
	elif command -v shasum >/dev/null 2>&1; then SHACMD="shasum -a 256"; fi
	if [ -n "$SHACMD" ]; then
		SUMS=$(mktemp 2>/dev/null || echo "/tmp/osmrouter-sums.$$")
		if download "${BASE}/checksums.txt" "$SUMS"; then
			WANT=$(grep " ${ASSET}\$" "$SUMS" 2>/dev/null | awk '{print $1}')
			GOT=$($SHACMD "$TMP" | awk '{print $1}')
			if [ -n "$WANT" ] && [ "$WANT" != "$GOT" ]; then
				err "checksum mismatch! expected $WANT, got $GOT — aborting."
				exit 1
			fi
			[ -n "$WANT" ] && echo "Checksum verified."
		fi
	fi
fi

chmod +x "$TMP"

# --- install (create dir, elevate only if needed) --------------------------
TARGET="$BINDIR/osmrouter"
if mkdir -p "$BINDIR" 2>/dev/null && [ -w "$BINDIR" ]; then
	mv "$TMP" "$TARGET"
elif command -v sudo >/dev/null 2>&1; then
	echo "Installing to $BINDIR (needs sudo)…"
	sudo mkdir -p "$BINDIR"
	sudo mv "$TMP" "$TARGET"
else
	err "cannot write to $BINDIR and sudo is unavailable."
	err "re-run with a writable dir, e.g.:  OSM_BINDIR=\$HOME/.local/bin sh"
	exit 1
fi
trap - EXIT  # binary moved; nothing to clean

echo "Installed: $TARGET"

# --- PATH check ------------------------------------------------------------
case ":${PATH}:" in
	*":${BINDIR}:"*) ;;
	*)
		echo
		echo "Note: $BINDIR is not on your PATH. Add it:"
		echo "  export PATH=\"$BINDIR:\$PATH\"   # add to ~/.zshrc or ~/.bashrc"
		;;
esac

echo
echo "Next:"
echo "  1. Create a token at https://app.osmrouter.com (Tokens)"
echo "  2. export OSM_TOKEN=osm_xxxxx"
echo "  3. osmrouter http 8080"
