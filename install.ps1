# osmRouter CLI installer for Windows.
# Usage (PowerShell):  irm https://osmrouter.com/install.ps1 | iex
#
# Installs osmrouter.exe to %LOCALAPPDATA%\osmRouter\bin and adds it to your
# user PATH. macOS/Linux: curl -fsSL https://osmrouter.com/install.sh | sh
#
# Knobs (env): OSM_REPO, OSM_BINDIR, OSM_VERSION (default: latest),
#              OSM_NO_VERIFY=1 to skip checksum verification.

$ErrorActionPreference = "Stop"

# Force TLS 1.2 — older Windows PowerShell defaults can fail against GitHub.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$Repo    = if ($env:OSM_REPO)    { $env:OSM_REPO }    else { "osm-API/osmrouter" }
$BinDir  = if ($env:OSM_BINDIR)  { $env:OSM_BINDIR }  else { Join-Path $env:LOCALAPPDATA "osmRouter\bin" }
$Version = if ($env:OSM_VERSION) { $env:OSM_VERSION } else { "" }

# Detect architecture.
$arch = switch ($env:PROCESSOR_ARCHITECTURE) {
	"AMD64" { "amd64" }
	"ARM64" { "arm64" }
	"x86"   { throw "osmRouter: 32-bit Windows is not supported." }
	default { "amd64" }
}

# Resolve the newest CLI release (tag vX.Y.Z) explicitly — /releases/latest is
# shared with the desktop app's desktop-v* releases, which have no CLI binaries.
if (-not $Version) {
	try {
		$rels = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases?per_page=30" -UseBasicParsing
		$Version = ($rels | Where-Object { $_.tag_name -match '^v\d+\.\d+\.\d+$' } | Select-Object -First 1).tag_name
	} catch { }
}
if (-not $Version) { $Version = "v1.2.1" }  # fallback if the API is unreachable

$asset = "osmrouter-windows-$arch.exe"
$base  = "https://github.com/$Repo/releases/download/$Version"

$exe = Join-Path $BinDir "osmrouter.exe"
$tmp = Join-Path $env:TEMP ("osmrouter-" + [Guid]::NewGuid().ToString("N") + ".exe")

Write-Host "Downloading osmRouter (windows/$arch)..."
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
try {
	Invoke-WebRequest -Uri "$base/$asset" -OutFile $tmp -UseBasicParsing
} catch {
	Write-Error "osmRouter: download failed from $base/$asset`nSee https://github.com/$Repo/releases for available builds."
	exit 1
}

# Sanity: a real binary is well over 1 MB (catches HTML error pages).
if ((Get-Item $tmp).Length -lt 1MB) {
	Remove-Item $tmp -Force -ErrorAction SilentlyContinue
	Write-Error "osmRouter: downloaded file looks wrong - aborting."
	exit 1
}

# Verify checksum (best-effort).
if ($env:OSM_NO_VERIFY -ne "1") {
	try {
		$sums = (Invoke-WebRequest -Uri "$base/checksums.txt" -UseBasicParsing).Content
		$line = ($sums -split "`n" | Where-Object { $_ -match [regex]::Escape($asset) } | Select-Object -First 1)
		if ($line) {
			$want = ($line -split "\s+")[0].ToLower()
			$got  = (Get-FileHash -Algorithm SHA256 -Path $tmp).Hash.ToLower()
			if ($want -ne $got) {
				Remove-Item $tmp -Force -ErrorAction SilentlyContinue
				Write-Error "osmRouter: checksum mismatch! expected $want, got $got - aborting."
				exit 1
			}
			Write-Host "Checksum verified."
		}
	} catch { }  # checksums optional; don't block install
}

# Move into place (replace any running/old copy).
Move-Item -Force -Path $tmp -Destination $exe
Write-Host "Installed: $exe"

# Add BinDir to the user PATH if missing.
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) { $userPath = "" }
if (($userPath -split ";") -notcontains $BinDir) {
	[Environment]::SetEnvironmentVariable("Path", ($userPath.TrimEnd(";") + ";" + $BinDir), "User")
	$env:Path = "$env:Path;$BinDir"
	Write-Host "Added $BinDir to your user PATH (restart your terminal to pick it up)."
}

Write-Host ""
Write-Host "Next:"
Write-Host "  1. Create a token at https://app.osmrouter.com (Tokens)"
Write-Host "  2. `$env:OSM_TOKEN = 'osm_xxxxx'"
Write-Host "  3. osmrouter http 8080"
