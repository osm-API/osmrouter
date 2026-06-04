"use strict";

const DASH = "https://app.osmrouter.com";
const DOCS = "https://docs.osmrouter.com";
const $ = (id) => document.getElementById(id);

let ports = [];
let tstate = {}; // port -> tunnel state
let account = null;
const expanded = new Set();
const startedAt = {}; // port -> timestamp when it went online
let filter = "";

// ---------- toast ----------
function toast(msg, kind = "ok") {
	const el = document.createElement("div");
	el.className = `toast ${kind}`;
	el.textContent = msg;
	$("toasts").appendChild(el);
	setTimeout(() => {
		el.style.opacity = "0";
		setTimeout(() => el.remove(), 200);
	}, 2400);
}

// ---------- screens ----------
function show(s) {
	$("screen-connect").classList.toggle("hidden", s !== "connect");
	$("screen-main").classList.toggle("hidden", s !== "main");
}

async function init() {
	const token = await window.osm.getToken();
	if (!token) return show("connect");
	account = await window.osm.getAccount();
	setAccount(account);
	show("main");
	tstate = await window.osm.tunnelState();
	await refreshPorts();
	const v = await window.osm.validateToken(token);
	if (!v.ok) {
		show("connect");
		$("token-error").textContent = "Your saved token is no longer valid.";
	} else {
		account = v.account;
		setAccount(account);
	}
}

function setAccount(a) {
	if (!a) return;
	account = a;
	$("account").innerHTML = `${a.email} · <span class="plan">${a.plan}</span>`;
}

// ---------- connect ----------
$("token-reveal").onclick = () => {
	const i = $("token");
	i.type = i.type === "password" ? "text" : "password";
};
$("open-tokens").onclick = () => window.osm.openExternal(DASH);
$("token").addEventListener("keydown", (e) => {
	if (e.key === "Enter") $("connect-btn").click();
});
$("connect-btn").onclick = async () => {
	const token = $("token").value.trim();
	$("token-error").textContent = "";
	$("connect-btn").disabled = true;
	$("connect-btn").textContent = "Connecting…";
	const v = await window.osm.validateToken(token);
	$("connect-btn").disabled = false;
	$("connect-btn").textContent = "Connect";
	if (!v.ok) return ($("token-error").textContent = v.error || "Could not validate token.");
	setAccount(v.account);
	show("main");
	tstate = await window.osm.tunnelState();
	refreshPorts();
};

// ---------- topbar ----------
$("refresh-btn").onclick = () => refreshPorts();
$("search").oninput = (e) => {
	filter = e.target.value.trim().toLowerCase();
	render();
};
$("settings-btn").onclick = openSettings;

// ---------- ports ----------
async function refreshPorts() {
	ports = await window.osm.listPorts();
	render();
}

function fmtAgo(ts) {
	if (!ts) return "—";
	const s = Math.floor((Date.now() - ts) / 1000);
	if (s < 60) return s + "s";
	if (s < 3600) return Math.floor(s / 60) + "m";
	return Math.floor(s / 3600) + "h " + (Math.floor(s / 60) % 60) + "m";
}

function esc(s) {
	return String(s).replace(/[<>&]/g, (c) =>
		c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
	);
}

function reqCount(t) {
	return (t.logs || []).filter((l) => /\b\d{3}\b/.test(l.line)).length;
}

function logLine(l) {
	const safe = esc(l.line);
	const m = safe.match(/\b([1-5])\d\d\b/);
	const cls = m ? "s" + m[1] : "";
	return `<div class="l"><span class="${cls}">${safe}</span></div>`;
}

function statusBadge(t) {
	if (!t || t.status === "stopped")
		return '<span class="badge"><span class="d"></span>idle</span>';
	if (t.status === "connecting")
		return '<span class="badge connecting"><span class="d"></span>connecting</span>';
	return '<span class="badge online"><span class="d"></span>online</span>';
}

function render() {
	// merge listening ports + any tunneled-but-not-listening ports
	const keys = new Set(ports.map((p) => p.port));
	let merged = ports.slice();
	for (const k of Object.keys(tstate)) {
		if (!keys.has(Number(k)) && tstate[k].status !== "stopped") {
			merged.push({ port: Number(k), process: "—", address: tstate[k].url || "" });
		}
	}
	merged.sort((a, b) => a.port - b.port);
	if (filter) {
		merged = merged.filter(
			(p) =>
				String(p.port).includes(filter) ||
				(p.process || "").toLowerCase().includes(filter),
		);
	}

	// summary
	const activeTunnels = Object.values(tstate).filter((t) => t.status !== "stopped");
	$("sum-ports").textContent = ports.length;
	$("sum-tunnels").textContent = activeTunnels.length;
	$("sum-reqs").textContent = activeTunnels.reduce((n, t) => n + reqCount(t), 0);

	$("ports-empty").classList.toggle("hidden", merged.length > 0);

	$("ports").innerHTML = merged
		.map((p) => {
			const t = tstate[p.port];
			const online = t && t.status !== "stopped";
			const open = expanded.has(p.port) && online;
			const action = online
				? `<button class="ghost sm" data-stop="${p.port}">Stop</button>`
				: `<button class="primary sm" data-tunnel="${p.port}">Tunnel</button>`;

			let detail = "";
			if (open) {
				const proto = (t.opts && t.opts.proto) || "http";
				const isHttp = proto === "http";
				const url = t.url || "";
				const urlInner = url
					? (isHttp
							? `<a data-open="${esc(url)}">${esc(url)}</a>`
							: `<span class="u" data-copy="${esc(url)}">${esc(url)}</span>`) +
						`<button class="ghost icon" data-copy="${esc(url)}" title="Copy">⧉</button>` +
						(isHttp ? `<button class="ghost icon" data-open="${esc(url)}" title="Open">↗</button>` : "")
					: `<span class="muted">waiting for public URL…</span>`;
				const logs = (t.logs || []).map(logLine).join("");
				detail = `<div class="port-detail">
					<div class="url-card">${urlInner}</div>
					<div class="detail-stats">
						<div class="s"><div class="v">${proto.toUpperCase()}</div><div class="k">Protocol</div></div>
						<div class="s"><div class="v">${reqCount(t)}</div><div class="k">Requests</div></div>
						<div class="s"><div class="v">${fmtAgo(startedAt[p.port])}</div><div class="k">Uptime</div></div>
						<div class="s"><div class="v">localhost:${p.port}</div><div class="k">Forwarding</div></div>
					</div>
					${t.error ? `<p class="error">${esc(t.error)}</p>` : ""}
					<div class="log-head"><span class="t">Live requests</span></div>
					<div class="logs">${logs || '<div class="empty">No requests yet — traffic to your tunnel appears here.</div>'}</div>
				</div>`;
			}

			return `<div class="port ${online ? "live" : ""}">
				<div class="port-row ${online ? "click" : ""}" data-row="${p.port}">
					<div class="dot-port">${(t && t.opts && t.opts.proto) === "tcp" ? "⇄" : "🌐"}</div>
					<div class="port-num">:${p.port}</div>
					<div class="port-proc">
						<div class="name">${esc(p.process || "—")}</div>
						<div class="addr">${esc(p.address || "")}</div>
					</div>
					${online && (t.opts && t.opts.proto) ? `<span class="badge proto">${(t.opts.proto || "").toUpperCase()}</span>` : ""}
					${statusBadge(t)}
					${action}
				</div>
				${detail}
			</div>`;
		})
		.join("");
}

$("ports").addEventListener("click", (e) => {
	const el = e.target.closest("[data-tunnel],[data-stop],[data-row],[data-open],[data-copy]");
	if (!el) return;
	if (el.dataset.tunnel) openDialog(Number(el.dataset.tunnel));
	else if (el.dataset.stop) {
		window.osm.stopTunnel(Number(el.dataset.stop));
		toast("Tunnel stopped");
	} else if (el.dataset.open) window.osm.openExternal(el.dataset.open);
	else if (el.dataset.copy) {
		window.osm.copy(el.dataset.copy);
		toast("Copied to clipboard");
	} else if (el.dataset.row) {
		const port = Number(el.dataset.row);
		if (tstate[port] && tstate[port].status !== "stopped") {
			expanded.has(port) ? expanded.delete(port) : expanded.add(port);
			render();
		}
	}
});

window.osm.onTunnelsUpdate((state) => {
	for (const k of Object.keys(state)) {
		const port = Number(k);
		const wasOnline = tstate[k] && tstate[k].status !== "stopped";
		const isOnline = state[k].status !== "stopped";
		if (isOnline) {
			expanded.add(port);
			if (!startedAt[port]) startedAt[port] = Date.now();
			if (!wasOnline && state[k].status === "online" && state[k].url) {
				toast("Tunnel online → " + state[k].url);
			}
		} else if (wasOnline) {
			delete startedAt[port];
		}
	}
	tstate = state;
	render();
});

// ---------- tunnel dialog ----------
let dialogPort = null;
let dialogProto = "http";
function openDialog(port) {
	dialogPort = port;
	dialogProto = "http";
	$("dialog-title").textContent = `Tunnel port :${port}`;
	$("opt-subdomain").value = "";
	$("opt-domain").value = "";
	$("opt-basicauth").value = "";
	$("dialog-error").textContent = "";
	document.querySelectorAll(".seg-btn").forEach((b) =>
		b.classList.toggle("active", b.dataset.proto === "http"),
	);
	$("http-opts").classList.remove("hidden");
	$("dialog").classList.remove("hidden");
}
const closeDialog = () => $("dialog").classList.add("hidden");
document.querySelectorAll(".seg-btn").forEach((b) => {
	b.onclick = () => {
		dialogProto = b.dataset.proto;
		document.querySelectorAll(".seg-btn").forEach((x) => x.classList.toggle("active", x === b));
		$("http-opts").classList.toggle("hidden", dialogProto !== "http");
	};
});
$("dialog-cancel").onclick = closeDialog;
$("dialog-start").onclick = async () => {
	const opts = { port: dialogPort, proto: dialogProto };
	if (dialogProto === "http") {
		const sub = $("opt-subdomain").value.trim();
		const dom = $("opt-domain").value.trim();
		const ba = $("opt-basicauth").value.trim();
		if (sub) opts.subdomain = sub;
		if (dom) opts.domain = dom;
		if (ba) {
			if (!/^[^:]+:[^:]+$/.test(ba)) return ($("dialog-error").textContent = "Basic Auth must be user:pass.");
			opts.basicAuth = ba;
		}
	}
	const r = await window.osm.startTunnel(opts);
	if (!r.ok) return ($("dialog-error").textContent = r.error || "Could not start tunnel.");
	expanded.add(dialogPort);
	closeDialog();
	toast(`Starting ${dialogProto.toUpperCase()} tunnel on :${dialogPort}…`);
};

// ---------- settings ----------
async function openSettings() {
	$("set-email").textContent = (account && account.email) || "—";
	$("set-plan").textContent = (account && account.plan) || "—";
	$("set-version").textContent = "v" + (await window.osm.appVersion());
	$("settings").classList.remove("hidden");
}
$("settings-close").onclick = () => $("settings").classList.add("hidden");
$("set-docs").onclick = () => window.osm.openExternal(DOCS);
$("set-disconnect").onclick = async () => {
	await window.osm.clearToken();
	tstate = {};
	$("token").value = "";
	$("settings").classList.add("hidden");
	show("connect");
};

// backdrop click closes modals
for (const id of ["dialog", "settings"]) {
	$(id).addEventListener("click", (e) => {
		if (e.target === $(id)) $(id).classList.add("hidden");
	});
}

// periodic refresh: ports every 5s, uptime re-render every 1s when tunnels active
setInterval(() => {
	if (!$("screen-main").classList.contains("hidden")) refreshPorts();
}, 5000);
setInterval(() => {
	if (Object.values(tstate).some((t) => t.status !== "stopped")) render();
}, 1000);

init();
