"use strict";
// Manages osmrouter tunnel child processes — one per local port. Parses the
// public URL and streams the live request log out of the binary's stdout.

const { spawn } = require("node:child_process");
const { ensureBinary } = require("./binary");

const API = process.env.OSM_API || "https://api.osmrouter.com";
const RELAY = process.env.OSM_RELAY || "tunnel.osmrouter.com:8443";
const DOMAIN_DEFAULT = process.env.OSM_DOMAIN || "osmrouter.com";

// key (local port) -> tunnel state
const tunnels = new Map();
let notify = () => {};

function setNotifier(fn) {
	notify = fn;
}

function publicState() {
	const out = {};
	for (const [port, t] of tunnels) {
		out[port] = {
			port,
			proto: t.opts.proto,
			status: t.status,
			url: t.url,
			opts: t.opts,
			logs: t.logs.slice(-200),
			error: t.error || null,
		};
	}
	return out;
}

function pushLog(t, line) {
	t.logs.push({ ts: Date.now(), line });
	if (t.logs.length > 500) t.logs.shift();
}

async function start(token, opts) {
	// opts: { port, proto: 'http'|'tcp', subdomain?, basicAuth?, domain? }
	const port = Number(opts.port);
	if (tunnels.has(port) && tunnels.get(port).status !== "stopped") {
		return { ok: false, error: "A tunnel is already running for this port." };
	}
	if (!token) return { ok: false, error: "No token. Connect first." };

	let exe;
	try {
		exe = await ensureBinary();
	} catch (e) {
		return { ok: false, error: `tunnel client unavailable: ${e.message}` };
	}
	const proto = opts.proto === "tcp" ? "tcp" : "http";
	const env = {
		...process.env,
		OSM_TOKEN: token,
		OSM_API: API,
		OSM_RELAY: RELAY,
		OSM_DOMAIN: opts.domain || DOMAIN_DEFAULT,
	};
	if (proto === "http" && opts.subdomain) env.OSM_SUBDOMAIN = opts.subdomain;
	if (proto === "http" && opts.basicAuth) env.OSM_BASIC_AUTH = opts.basicAuth;

	let child;
	try {
		child = spawn(exe, [proto, String(port)], { env });
	} catch (e) {
		return { ok: false, error: e.message };
	}

	const t = {
		child,
		opts: { port, proto, ...opts },
		status: "connecting",
		url: null,
		logs: [],
		error: null,
	};
	tunnels.set(port, t);

	const onData = (buf) => {
		for (const raw of buf.toString().split("\n")) {
			const line = raw.replace(/\s+$/, "");
			if (!line.trim()) continue;
			// Public address: "Forwarding   <addr>  ->  <local>"
			const m = line.match(/Forwarding\s+(\S+)/);
			if (m && !t.url) {
				t.url = m[1];
				t.status = "online";
			}
			// Don't echo the banner lines as logs; keep request lines + errors.
			if (
				!/osmRouter tunnel online|Forwarding|Press Ctrl|Protected|^\s*Requests\s*$/.test(
					line,
				)
			) {
				pushLog(t, line.trim());
			}
			notify(publicState());
		}
	};

	child.stdout.on("data", onData);
	child.stderr.on("data", onData);
	child.on("error", (e) => {
		t.status = "stopped";
		t.error = e.message;
		notify(publicState());
	});
	child.on("exit", (code) => {
		t.status = "stopped";
		if (code && code !== 0 && !t.error) t.error = `exited (code ${code})`;
		notify(publicState());
	});

	notify(publicState());
	return { ok: true };
}

function stop(port) {
	const t = tunnels.get(Number(port));
	if (!t) return { ok: false, error: "not running" };
	try {
		t.child.kill();
	} catch {
		/* ignore */
	}
	t.status = "stopped";
	notify(publicState());
	return { ok: true };
}

function stopAll() {
	for (const t of tunnels.values()) {
		try {
			t.child.kill();
		} catch {
			/* ignore */
		}
	}
}

module.exports = { start, stop, stopAll, publicState, setNotifier };
