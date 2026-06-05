# osmRouter CLI installer for Windows.
# Usage (PowerShell):  irm https://osmrouter.com/install.ps1 | iex
#
# Installs osmrouter.exe to %LOCALAPPDATA%\osmRouter\bin and adds it to your
# user PATH (no admin needed). macOS/Linux: curl -fsSL https://osmrouter.com/install.sh | sh
#
# Knobs (env): OSM_REPO, OSM_BINDIR, OSM_VERSION (default: newest vX.Y.Z),
#              OSM_NO_VERIFY=1 to skip checksum verification.

$ErrorActionPreference = "Stop"
$FallbackVersion = "v1.2.1"
$Repo = if ($env:OSM_REPO) { $env:OSM_REPO } else { "osm-API/osmrouter" }

# Print actionable help on ANY unhandled terminating error, then stop — so the
# user never sees a bare red stack trace with no idea what to do next.
trap {
	Write-Host ""
	Write-Host "osmRouter: install did not complete." -ForegroundColor Red
	Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
	Write-Host ""
	Write-Host "Try one of these:"
	Write-Host "  - Pin the version (skips the GitHub API, which some networks block):"
	Write-Host "      `$env:OSM_VERSION='$FallbackVersion'; irm https://osmrouter.com/install.ps1 | iex"
	Write-Host "  - Behind a proxy? Set it first:"
	Write-Host "      `$env:HTTPS_PROXY='http://HOST:PORT'"
	Write-Host "  - All builds: https://github.com/$Repo/releases"
	break
}

# Enable modern TLS — older Windows PowerShell (5.1) defaults to TLS 1.0/1.1,
# which GitHub rejects ("Could not create SSL/TLS secure channel").
try {
	[Net.ServicePointManager]::SecurityProtocol =
		[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}
try {
	[Net.ServicePointManager]::SecurityProtocol =
		[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls13
} catch {}

$BinDir  = if ($env:OSM_BINDIR)  { $env:OSM_BINDIR }  else { Join-Path $env:LOCALAPPDATA "osmRouter\bin" }
$Version = if ($env:OSM_VERSION) { $env:OSM_VERSION } else { "" }

# Detect architecture (covers ARM64 Windows and x86-on-ARM emulation).
$pa = $env:PROCESSOR_ARCHITECTURE
$pw = ${env:PROCESSOR_ARCHITEW6432}
$arch = if ($pa -eq "ARM64" -or $pw -eq "ARM64") { "arm64" }
		elseif ($pa -eq "AMD64" -or $pw -eq "AMD64") { "amd64" }
		elseif ($pa -eq "x86") { "amd64" }   # 32-bit shell on 64-bit Windows
		else { "amd64" }

# Resolve the newest CLI release (tag vX.Y.Z) explicitly — /releases/latest is
# shared with the desktop app's desktop-v* releases, which have no CLI binaries.
if (-not $Version) {
	try {
		$rels = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases?per_page=30" -UseBasicParsing
		$Version = ($rels | Where-Object { $_.tag_name -match '^v\d+\.\d+\.\d+$' } | Select-Object -First 1).tag_name
	} catch { }
}
if (-not $Version) { $Version = $FallbackVersion }  # fallback if the API is unreachable

$asset = "osmrouter-windows-$arch.exe"
$base  = "https://github.com/$Repo/releases/download/$Version"
$exe   = Join-Path $BinDir "osmrouter.exe"
$tmp   = Join-Path $env:TEMP ("osmrouter-" + [Guid]::NewGuid().ToString("N") + ".exe")

Write-Host "Downloading osmRouter $Version (windows/$arch)..."
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
try {
	Invoke-WebRequest -Uri "$base/$asset" -OutFile $tmp -UseBasicParsing
} catch {
	throw "couldn't download $base/$asset — GitHub may be unreachable from this machine (proxy/firewall?)."
}

# Sanity: a real binary is well over 1 MB (catches HTML error / proxy pages).
if ((Get-Item $tmp).Length -lt 1MB) {
	Remove-Item $tmp -Force -ErrorAction SilentlyContinue
	throw "the downloaded file is too small to be the binary — a proxy or captive portal likely intercepted the request."
}

# Verify checksum (best-effort; never blocks install if checksums are absent).
if ($env:OSM_NO_VERIFY -ne "1") {
	try {
		$sums = (Invoke-WebRequest -Uri "$base/checksums.txt" -UseBasicParsing).Content
		$line = ($sums -split "`n" | Where-Object { $_ -match [regex]::Escape($asset) } | Select-Object -First 1)
		if ($line) {
			$want = ($line -split "\s+")[0].ToLower()
			$got  = (Get-FileHash -Algorithm SHA256 -Path $tmp).Hash.ToLower()
			if ($want -ne $got) {
				Remove-Item $tmp -Force -ErrorAction SilentlyContinue
				throw "checksum mismatch! expected $want, got $got."
			}
			Write-Host "Checksum verified."
		}
	} catch {
		if ($_.Exception.Message -match "checksum mismatch") { throw }
		# else: checksums optional — ignore fetch/parse errors.
	}
}

# Move into place (replace any running/old copy).
Move-Item -Force -Path $tmp -Destination $exe
Write-Host "Installed: $exe"

# Post-install verification.
try {
	$v = & $exe version 2>$null
	if ($v) { Write-Host "  $v" }
} catch {}

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
Write-Host "  3. osmrouter http 8080            # or any local port"
