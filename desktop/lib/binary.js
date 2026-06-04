"use strict";
// Resolves a *working* osmrouter binary. Prefers the one bundled with the app;
// if it's missing or the wrong architecture (can happen for cross-arch builds),
// downloads the correct platform/arch binary into userData and uses that.

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { spawnSync } = require("node:child_process");
const { app } = require("electron");

const REPO = process.env.OSM_REPO || "osm-API/osmrouter";
const osMap = { darwin: "darwin", linux: "linux", win32: "windows" };
const archMap = { x64: "amd64", arm64: "arm64" };

function exeName() {
	return process.platform === "win32" ? "osmrouter.exe" : "osmrouter";
}

function bundledPath() {
	const exe = exeName();
	const candidates = [
		path.join(process.resourcesPath || "", "bin", exe),
		path.join(__dirname, "..", "bin", exe),
	];
	return candidates.find((c) => c && fs.existsSync(c)) || null;
}

function works(p) {
	if (!p || !fs.existsSync(p)) return false;
	try {
		const r = spawnSync(p, ["version"], { timeout: 5000 });
		return r.status === 0;
	} catch {
		return false;
	}
}

function download(url, dest) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest, { mode: 0o755 });
		const go = (u, n = 0) => {
			if (n > 6) return reject(new Error("too many redirects"));
			https
				.get(u, { headers: { "user-agent": "osmrouter-desktop" } }, (res) => {
					if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
						res.resume();
						return go(res.headers.location, n + 1);
					}
					if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
					res.pipe(file);
					file.on("finish", () => file.close(() => resolve(dest)));
				})
				.on("error", reject);
		};
		go(url);
	});
}

let cached = null;

async function ensureBinary() {
	if (cached && works(cached)) return cached;

	const bundled = bundledPath();
	if (works(bundled)) {
		cached = bundled;
		return bundled;
	}

	// Download the correct binary for this platform/arch into userData.
	const os = osMap[process.platform];
	const goarch = archMap[process.arch];
	if (!os || !goarch) throw new Error(`unsupported platform ${process.platform}/${process.arch}`);
	const ext = os === "windows" ? ".exe" : "";
	const url = `https://github.com/${REPO}/releases/latest/download/osmrouter-${os}-${goarch}${ext}`;
	const dir = path.join(app.getPath("userData"), "bin");
	fs.mkdirSync(dir, { recursive: true });
	const dest = path.join(dir, exeName());
	await download(url, dest);
	try {
		fs.chmodSync(dest, 0o755);
	} catch {
		/* windows */
	}
	if (!works(dest)) throw new Error("downloaded binary failed to run");
	cached = dest;
	return dest;
}

module.exports = { ensureBinary };
