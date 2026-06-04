"use strict";

const {
	app,
	BrowserWindow,
	ipcMain,
	shell,
	clipboard,
	nativeTheme,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const { listPorts } = require("./lib/ports");
const tunnels = require("./lib/tunnels");

const API = process.env.OSM_API || "https://api.osmrouter.com";
const configPath = () => path.join(app.getPath("userData"), "config.json");

function readConfig() {
	try {
		return JSON.parse(fs.readFileSync(configPath(), "utf8"));
	} catch {
		return {};
	}
}
function writeConfig(c) {
	try {
		fs.writeFileSync(configPath(), JSON.stringify(c, null, 2));
	} catch {
		/* ignore */
	}
}

function validateToken(token) {
	return new Promise((resolve) => {
		if (!token) return resolve({ ok: false, error: "Enter a token." });
		const req = https.request(
			`${API}/v1/agent/me`,
			{ method: "GET", headers: { authorization: `Bearer ${token}` } },
			(res) => {
				let body = "";
				res.on("data", (d) => (body += d));
				res.on("end", () => {
					if (res.statusCode === 200) {
						try {
							resolve({ ok: true, account: JSON.parse(body) });
						} catch {
							resolve({ ok: false, error: "Bad response from server." });
						}
					} else if (res.statusCode === 401) {
						resolve({ ok: false, error: "That token is invalid or revoked." });
					} else {
						resolve({ ok: false, error: `Validation failed (HTTP ${res.statusCode}).` });
					}
				});
			},
		);
		req.on("error", (e) => resolve({ ok: false, error: e.message }));
		req.end();
	});
}

let win;
function createWindow() {
	win = new BrowserWindow({
		width: 1040,
		height: 720,
		minWidth: 820,
		minHeight: 560,
		backgroundColor: "#0a0a0a",
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});
	win.loadFile(path.join(__dirname, "renderer", "index.html"));

	tunnels.setNotifier((state) => {
		if (win && !win.isDestroyed()) win.webContents.send("tunnels:update", state);
	});
}

app.whenReady().then(() => {
	nativeTheme.themeSource = "dark";
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	tunnels.stopAll();
	if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => tunnels.stopAll());

// ---- IPC ----
ipcMain.handle("token:get", () => readConfig().token || "");
ipcMain.handle("token:validate", async (_e, token) => {
	const r = await validateToken(token);
	if (r.ok) writeConfig({ ...readConfig(), token, account: r.account });
	return r;
});
ipcMain.handle("token:account", () => readConfig().account || null);
ipcMain.handle("token:clear", () => {
	tunnels.stopAll();
	const c = readConfig();
	delete c.token;
	delete c.account;
	writeConfig(c);
	return true;
});

ipcMain.handle("ports:list", async () => {
	try {
		return await listPorts();
	} catch {
		return [];
	}
});

ipcMain.handle("tunnel:start", (_e, opts) =>
	tunnels.start(readConfig().token, opts),
);
ipcMain.handle("tunnel:stop", (_e, port) => tunnels.stop(port));
ipcMain.handle("tunnel:state", () => tunnels.publicState());

ipcMain.handle("util:openExternal", (_e, url) => shell.openExternal(url));
ipcMain.handle("util:copy", (_e, text) => clipboard.writeText(String(text)));
