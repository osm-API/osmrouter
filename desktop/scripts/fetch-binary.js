#!/usr/bin/env node
// Downloads the osmrouter CLI binary for the current platform into ./bin so
// electron-builder can bundle it as an extra resource. Runs on postinstall and
// before packaging — each OS build bundles its own binary.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const REPO = process.env.OSM_REPO || "osm-API/osmrouter";

const osMap = { darwin: "darwin", linux: "linux", win32: "windows" };
const archMap = { x64: "amd64", arm64: "arm64" };

const os = osMap[process.platform];
const goarch = archMap[process.arch];

if (!os || !goarch) {
	console.warn(`[osmrouter-desktop] no binary for ${process.platform}/${process.arch}`);
	process.exit(0);
}

const ext = os === "windows" ? ".exe" : "";
const url = `https://github.com/${REPO}/releases/latest/download/osmrouter-${os}-${goarch}${ext}`;
const binDir = path.join(__dirname, "..", "bin");
const dest = path.join(binDir, `osmrouter${ext}`);

function download(u, file, redirects = 0) {
	if (redirects > 6) return file.destroy(new Error("too many redirects"));
	https
		.get(u, { headers: { "user-agent": "osmrouter-desktop" } }, (res) => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				res.resume();
				return download(res.headers.location, file, redirects + 1);
			}
			if (res.statusCode !== 200) {
				file.destroy(new Error(`HTTP ${res.statusCode}`));
				return;
			}
			res.pipe(file);
		})
		.on("error", (e) => file.destroy(e));
}

try {
	fs.mkdirSync(binDir, { recursive: true });
	const file = fs.createWriteStream(dest, { mode: 0o755 });
	file.on("finish", () => {
		try {
			fs.chmodSync(dest, 0o755);
		} catch {
			/* windows */
		}
		console.log(`[osmrouter-desktop] bundled binary for ${os}/${goarch}`);
	});
	file.on("error", (e) =>
		console.warn(`[osmrouter-desktop] binary download failed: ${e.message}`),
	);
	download(url, file);
} catch (e) {
	console.warn(`[osmrouter-desktop] fetch-binary skipped: ${e.message}`);
}
