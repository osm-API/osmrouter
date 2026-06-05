#!/bin/sh
# osmRouter CLI installer.  Usage:  curl -fsSL https://osmrouter.com/install.sh | sh
#
# macOS and Linux (amd64/arm64). On Windows, use PowerShell instead:
#   irm https://osmrouter.com/install.ps1 | iex
#
# Knobs (env): OSM_REPO, OSM_BINDIR, OSM_VERSION (default: newest vX.Y.Z),
#              OSM_NO_VERIFY=1 to skip checksum verification,
#              OSM_DEBUG=1 to print a full execution trace.
set -eu

FALLBACK_VERSION="v1.2.1"
REPO="${OSM_REPO:-osm-API/osmrouter}"
VERSION="${OSM_VERSION:-}"
[ "${OSM_DEBUG:-}" = "1" ] && set -x

err() { echo "osmRouter: $*" >&2; }

# --- never exit silently ---------------------------------------------------
# Under `set -e` any unexpected non-zero command aborts the script with no
# message. This guard fires on EVERY exit and, unless we finished cleanly,
# prints actionable next steps (covers locked-down networks, proxies, etc).
DONE=0
TMP=""
SUMS=""
on_exit() {
	st=$?
	[ -n "$TMP" ] && rm -f "$TMP" 2>/dev/null || true
	[ -n "$SUMS" ] && rm -f "$SUMS" 2>/dev/null || true
	if [ "$DONE" != "1" ] && [ "$st" != "0" ]; then
		echo "" >&2
		err "install did not complete (exit $st)."
		err "Try one of these:"
		err "  • Pin the version (skips the GitHub API, which some networks block):"
		err "      curl -fsSL https://osmrouter.com/install.sh | OSM_VERSION=$FALLBACK_VERSION sh"
		err "  • Behind a proxy? Export it first:"
		err "      export https_proxy=http://HOST:PORT http_proxy=http://HOST:PORT"
		err "  • Install to your home dir (no sudo):"
		err "      curl -fsSL https://osmrouter.com/install.sh | OSM_BINDIR=\$HOME/.local/bin sh"
		err "  • See all builds: https://github.com/$REPO/releases"
		err "  • Re-run with OSM_DEBUG=1 for a full trace."
	fi
}
trap on_exit EXIT INT TERM

# --- detect platform -------------------------------------------------------
OS=$(uname -s 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo unknown)
ARCH=$(uname -m 2>/dev/null || echo unknown)

case "$ARCH" in
	x86_64 | amd64) ARCH=amd64 ;;
	aarch64 | arm64) ARCH=arm64 ;;
	armv7* | armv6* | arm)
		err "32-bit ARM isn't supported (need arm64). Use the Node SDK: npm i @omsapi/osmrouter"
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

# --- need a downloader -----------------------------------------------------
if command -v curl >/dev/null 2>&1; then
	DL=curl
elif command -v wget >/dev/null 2>&1; then
	DL=wget
else
	err "need 'curl' or 'wget' installed. On Debian/Ubuntu: sudo apt-get install -y curl"
	exit 1
fi

http_get() { # http_get <url>  -> stdout (best-effort, never aborts)
	if [ "$DL" = curl ]; then curl -fsSL "$1" 2>/dev/null || true
	else wget -qO- "$1" 2>/dev/null || true; fi
}
download() { # download <url> <dest>  -> 0 on success
	if [ "$DL" = curl ]; then curl -fSL "$1" -o "$2" 2>/dev/null
	else wget -q "$1" -O "$2" 2>/dev/null; fi
}

# --- resolve the CLI version ----------------------------------------------
# Newest CLI release (tag vX.Y.Z). We resolve it explicitly via the API and do
# NOT use /releases/latest — that pointer is shared with desktop-v*/mobile-v*
# releases, which don't contain CLI binaries. `|| true` keeps a blocked or
# rate-limited API from killing the script under `set -e` (the classic silent
# failure) — we just fall back to the pinned version below.
if [ -z "$VERSION" ]; then
	VERSION=$(http_get "https://api.github.com/repos/${REPO}/releases?per_page=30" |
		grep -oE '"tag_name": *"v[0-9]+\.[0-9]+\.[0-9]+"' |
		head -n 1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || true)
fi
[ -z "$VERSION" ] && VERSION="$FALLBACK_VERSION"

ASSET="osmrouter-${OS}-${ARCH}"
BASE="https://github.com/${REPO}/releases/download/${VERSION}"
TMP=$(mktemp 2>/dev/null || echo "/tmp/osmrouter.$$")

echo "Downloading osmRouter ${VERSION} (${OS}/${ARCH})…"
if ! download "${BASE}/${ASSET}" "$TMP"; then
	err "couldn't download ${BASE}/${ASSET}"
	err "GitHub may be unreachable from this machine. If you have a proxy, export"
	err "https_proxy/http_proxy and retry; otherwise download the binary manually"
	err "from https://github.com/$REPO/releases and place it at the target path."
	exit 1
fi

# --- sanity: a real binary is well over 1 MB (catches HTML error pages) -----
SIZE=$(wc -c < "$TMP" 2>/dev/null | tr -d ' ' || echo 0)
if [ "${SIZE:-0}" -lt 1000000 ]; then
	err "the downloaded file is only ${SIZE:-0} bytes — that's an error page, not the binary."
	err "A proxy or captive portal likely intercepted the request. Check connectivity"
	err "to github.com, or set https_proxy. Builds: https://github.com/$REPO/releases"
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
			WANT=$(grep " ${ASSET}\$" "$SUMS" 2>/dev/null | awk '{print $1}' || true)
			GOT=$($SHACMD "$TMP" 2>/dev/null | awk '{print $1}' || true)
			if [ -n "$WANT" ] && [ -n "$GOT" ] && [ "$WANT" != "$GOT" ]; then
				err "checksum mismatch! expected $WANT, got $GOT — aborting."
				exit 1
			fi
			[ -n "$WANT" ] && [ "$WANT" = "$GOT" ] && echo "Checksum verified."
		fi
	fi
fi

chmod +x "$TMP" 2>/dev/null || true

# --- pick an install dir that actually works -------------------------------
# Order: explicit OSM_BINDIR → writable /usr/local/bin → sudo /usr/local/bin →
# ~/.local/bin (no sudo). We never hard-fail on permissions: if elevation isn't
# possible we silently fall back to the user-local dir.
USED_SUDO=0
choose_and_install() {
	dir="$1"
	if mkdir -p "$dir" 2>/dev/null && [ -w "$dir" ]; then
		BINDIR="$dir"; mv "$TMP" "$BINDIR/osmrouter"; return 0
	fi
	return 1
}

if [ -n "${OSM_BINDIR:-}" ]; then
	# User asked for a specific dir — honour it, elevating only if needed.
	if choose_and_install "$OSM_BINDIR"; then :
	elif command -v sudo >/dev/null 2>&1 && sudo mkdir -p "$OSM_BINDIR" 2>/dev/null; then
		echo "Installing to $OSM_BINDIR (needs sudo)…"
		sudo mv "$TMP" "$OSM_BINDIR/osmrouter"; BINDIR="$OSM_BINDIR"; USED_SUDO=1
	else
		err "cannot write to $OSM_BINDIR (and sudo unavailable). Pick a writable dir."
		exit 1
	fi
elif choose_and_install "/usr/local/bin"; then
	:
elif command -v sudo >/dev/null 2>&1 && sudo -v 2>/dev/null && sudo mkdir -p /usr/local/bin 2>/dev/null; then
	echo "Installing to /usr/local/bin (needs sudo)…"
	sudo mv "$TMP" "/usr/local/bin/osmrouter"; BINDIR="/usr/local/bin"; USED_SUDO=1
else
	# No write access and no sudo — fall back to a per-user dir automatically.
	echo "No write access to /usr/local/bin; installing to \$HOME/.local/bin instead."
	choose_and_install "$HOME/.local/bin" || { err "couldn't write to \$HOME/.local/bin either."; exit 1; }
fi

TARGET="$BINDIR/osmrouter"
TMP=""  # moved; nothing to clean

# --- post-install verification --------------------------------------------
if [ ! -x "$TARGET" ]; then
	err "installed file at $TARGET is not executable — something went wrong."
	exit 1
fi
DONE=1
echo "Installed: $TARGET"
VER_OUT=$("$TARGET" version 2>/dev/null || "$TARGET" --version 2>/dev/null || true)
[ -n "$VER_OUT" ] && echo "  $VER_OUT"

# --- PATH check ------------------------------------------------------------
case ":${PATH}:" in
	*":${BINDIR}:"*) ;;
	*)
		echo
		echo "Note: $BINDIR is not on your PATH. Add it:"
		if [ "$BINDIR" = "$HOME/.local/bin" ]; then
			echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc && export PATH=\"\$HOME/.local/bin:\$PATH\""
		else
			echo "  export PATH=\"$BINDIR:\$PATH\"   # add to ~/.zshrc or ~/.bashrc"
		fi
		;;
esac

echo
echo "Next:"
echo "  1. Create a token at https://app.osmrouter.com (Tokens)"
echo "  2. export OSM_TOKEN=osm_xxxxx"
echo "  3. osmrouter http 8080            # or any local port"
