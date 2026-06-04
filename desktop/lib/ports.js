"use strict";
// Lists local TCP ports in the LISTEN state, with the owning process where
// available. Cross-platform: lsof (macOS), ss/lsof (Linux), netstat+tasklist
// (Windows).

const { execFile } = require("node:child_process");

function run(cmd, args) {
	return new Promise((resolve) => {
		execFile(cmd, args, { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
			resolve(err ? "" : stdout || "");
		});
	});
}

function portFromAddr(addr) {
	// handles *:3000, 127.0.0.1:8080, [::1]:8080, 0.0.0.0:5432
	const i = addr.lastIndexOf(":");
	if (i < 0) return 0;
	const p = parseInt(addr.slice(i + 1), 10);
	return Number.isFinite(p) ? p : 0;
}

async function listMacLinux() {
	// lsof: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
	let out = await run("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN"]);
	const map = new Map();
	if (out) {
		for (const line of out.split("\n").slice(1)) {
			if (!line.trim()) continue;
			const cols = line.trim().split(/\s+/);
			if (cols.length < 9) continue;
			const proc = cols[0].replace(/\\x20/g, " ");
			const pid = parseInt(cols[1], 10);
			// NAME ends with "<addr>:<port> (LISTEN)"
			const m = line.match(/\sTCP\s+(\S+)\s+\(LISTEN\)/);
			const addr = m ? m[1] : "";
			const port = portFromAddr(addr);
			if (port && !map.has(port)) {
				map.set(port, { port, pid, process: proc, address: addr });
			}
		}
		if (map.size) return [...map.values()];
	}
	// Linux fallback: ss -ltnp
	out = await run("ss", ["-ltnpH"]);
	for (const line of out.split("\n")) {
		const m = line.match(/LISTEN\s+\d+\s+\d+\s+(\S+)/);
		if (!m) continue;
		const port = portFromAddr(m[1]);
		const pm = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
		if (port && !map.has(port)) {
			map.set(port, {
				port,
				pid: pm ? parseInt(pm[2], 10) : 0,
				process: pm ? pm[1] : "—",
				address: m[1],
			});
		}
	}
	return [...map.values()];
}

async function listWindows() {
	const out = await run("netstat", ["-ano", "-p", "TCP"]);
	const map = new Map();
	const pids = new Set();
	for (const line of out.split("\n")) {
		const c = line.trim().split(/\s+/);
		if (c.length < 5 || c[3] !== "LISTENING") continue;
		const port = portFromAddr(c[1]);
		const pid = parseInt(c[4], 10);
		if (port && !map.has(port)) {
			map.set(port, { port, pid, process: "—", address: c[1] });
			pids.add(pid);
		}
	}
	// Resolve PID -> process name via tasklist (CSV).
	const tl = await run("tasklist", ["/fo", "csv", "/nh"]);
	const names = new Map();
	for (const line of tl.split("\n")) {
		const m = line.match(/^"([^"]+)","(\d+)"/);
		if (m) names.set(parseInt(m[2], 10), m[1].replace(/\.exe$/i, ""));
	}
	for (const v of map.values()) {
		if (names.has(v.pid)) v.process = names.get(v.pid);
	}
	return [...map.values()];
}

async function listPorts() {
	const list =
		process.platform === "win32"
			? await listWindows()
			: await listMacLinux();
	return list
		.filter((p) => p.port > 0)
		.sort((a, b) => a.port - b.port);
}

module.exports = { listPorts };
