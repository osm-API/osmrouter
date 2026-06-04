"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("osm", {
	getToken: () => ipcRenderer.invoke("token:get"),
	validateToken: (t) => ipcRenderer.invoke("token:validate", t),
	getAccount: () => ipcRenderer.invoke("token:account"),
	clearToken: () => ipcRenderer.invoke("token:clear"),
	listPorts: () => ipcRenderer.invoke("ports:list"),
	startTunnel: (opts) => ipcRenderer.invoke("tunnel:start", opts),
	stopTunnel: (port) => ipcRenderer.invoke("tunnel:stop", port),
	tunnelState: () => ipcRenderer.invoke("tunnel:state"),
	openExternal: (url) => ipcRenderer.invoke("util:openExternal", url),
	copy: (text) => ipcRenderer.invoke("util:copy", text),
	onTunnelsUpdate: (cb) =>
		ipcRenderer.on("tunnels:update", (_e, state) => cb(state)),
});
