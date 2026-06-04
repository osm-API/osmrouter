"use strict";

const DASH = "https://app.osmrouter.com";
const $ = (id) => document.getElementById(id);

let ports = [];
let tstate = {}; // port -> tunnel state
const expanded = new Set(); // ports whose detail is open

// ---------- screens ----------
function show(screen) {
	$("screen-connect").classList.toggle("hidden", screen !== "connect");
	$("screen-main").classList.toggle("hidden", screen !== "main");
}

async function init() {
	const token = await window.osm.getToken();
	if (token) {
		const acct = await window.osm.getAccount();
		if (acct) setAccount(acct);
		show("main");
		tstate = await window.osm.tunnelState();
		await refreshPorts();
		// re-validate in the background; if it fails, bounce to connect
		const v = await window.osm.validateToken(token);
		if (!v.ok) {
			show("connect");
			$("token-error").textContent = "Your saved token is no longer valid.";
		} else {
			setAccount(v.account);
		}
	} else {
		show("connect");
	}
}

function setAccount(a) {
	if (!a) return;
	$("account").textContent = `${a.email} · ${a.plan} plan`;
}

// ---------- connect ----------
$("token-reveal").onclick = () => {
	const i = $("token");
	i.type = i.type === "password" ? "text" : "password";
};
$("open-tokens").onclick = () => window.osm.openExternal(DASH);

$("connect-btn").onclick = async () => {
	const token = $("token").value.trim();
	$("token-error").textContent = "";
	$("connect-btn").disabled = true;
	$("connect-btn").textContent = "Connecting…";
	const v = await window.osm.validateToken(token);
	$("connect-btn").disabled = false;
	$("connect-btn").textContent = "Connect";
	if (!v.ok) {
		$("token-error").textContent = v.error || "Could not validate token.";
		return;
	}
	setAccount(v.account);
	show("main");
	tstate = await window.osm.tunnelState();
	refreshPorts();
};
$("token").addEventListener("keydown", (e) => {
	if (e.key === "Enter") $("connect-btn").click();
});

$("signout-btn").onclick = async () => {
	await window.osm.clearToken();
	tstate = {};
	$("token").value = "";
	show("connect");
};
$("refresh-btn").onclick = () => refreshPorts();

// ---------- ports ----------
async function refreshPorts() {
	ports = await window.osm.listPorts();
	render();
}

function statusBadge(t) {
	if (!t || t.status === "stopped")
		return '<span class="badge"><span class="dot"></span>not tunneled</span>';
	if (t.status === "connecting")
		return '<span class="badge connecting"><span class="dot"></span>connecting</span>';
	return '<span class="badge online"><span class="dot"></span>online</span>';
}

function logLine(l) {
	const safe = l.line.replace(/[<>&]/g, (c) =>
		c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
	);
	const cls = / (2\d\d) /.test(" " + safe + " ")
		? "s2"
		: / ([45]\d\d) /.test(" " + safe + " ")
			? "s4"
			: "";
	return `<div class="l"><span class="${cls}">${safe}</span></div>`;
}

function render() {
	const wrap = $("ports");
	// merge: ports from scan + any tunneled ports not currently listening
	const keys = new Set(ports.map((p) => p.port));
	const merged = ports.slice();
	for (const k of Object.keys(tstate)) {
		if (!keys.has(Number(k)) && tstate[k].status !== "stopped") {
			merged.push({
				port: Number(k),
				process: "—",
				address: tstate[k].url || "",
			});
		}
	}
	merged.sort((a, b) => a.port - b.port);

	$("ports-count").textContent = merged.length
		? `${merged.length} listening`
		: "";
	$("ports-empty").classList.toggle("hidden", merged.length > 0);

	wrap.innerHTML = merged
		.map((p) => {
			const t = tstate[p.port];
			const online = t && t.status !== "stopped";
			const isOpen = expanded.has(p.port);
			const action = online
				? `<button class="ghost" data-stop="${p.port}">Stop</button>`
				: `<button class="primary" data-tunnel="${p.port}">Tunnel</button>`;
			let detail = "";
			if (online && isOpen) {
				const logs = (t.logs || [])
					.map(logLine)
					.join("");
				const proto = (t.opts && t.opts.proto) || "http";
				const urlHtml = t.url
					? `<a data-open="${t.url}">${t.url}</a>
					   <button class="ghost icon" data-copy="${t.url}" title="Copy">⧉</button>`
					: `<span class="muted">waiting for URL…</span>`;
				detail = `<div class="port-detail">
					<div class="url-row">
						<span class="badge online"><span class="dot"></span>${proto.toUpperCase()}</span>
						${urlHtml}
					</div>
					${t.error ? `<p class="error">${t.error}</p>` : ""}
					<div class="logs">${logs || '<div class="empty">No requests yet. Traffic will appear here.</div>'}</div>
				</div>`;
			}
			return `<div class="port">
				<div class="port-row" data-row="${p.port}" ${online ? 'style="cursor:pointer"' : ""}>
					<div class="port-num">:${p.port}</div>
					<div class="port-proc">
						<div class="name">${(p.process || "—").replace(/[<>&]/g, "")}</div>
						<div class="addr">${(p.address || "").replace(/[<>&]/g, "")}</div>
					</div>
					${statusBadge(t)}
					${action}
				</div>
				${detail}
			</div>`;
		})
		.join("");
}

// event delegation
$("ports").addEventListener("click", (e) => {
	const el = e.target.closest("[data-tunnel],[data-stop],[data-row],[data-open],[data-copy]");
	if (!el) return;
	if (el.dataset.tunnel) openDialog(Number(el.dataset.tunnel));
	else if (el.dataset.stop) window.osm.stopTunnel(Number(el.dataset.stop));
	else if (el.dataset.open) window.osm.openExternal(el.dataset.open);
	else if (el.dataset.copy) {
		window.osm.copy(el.dataset.copy);
		el.textContent = "✓";
		setTimeout(() => (el.textContent = "⧉"), 1200);
	} else if (el.dataset.row) {
		const port = Number(el.dataset.row);
		if (tstate[port] && tstate[port].status !== "stopped") {
			expanded.has(port) ? expanded.delete(port) : expanded.add(port);
			render();
		}
	}
});

window.osm.onTunnelsUpdate((state) => {
	tstate = state;
	// auto-open detail for newly online tunnels
	for (const k of Object.keys(state)) {
		if (state[k].status !== "stopped") expanded.add(Number(k));
	}
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
	$("dialog").parentElement.classList.remove("hidden");
}
function closeDialog() {
	$("dialog").parentElement.classList.add("hidden");
}

document.querySelectorAll(".seg-btn").forEach((b) => {
	b.onclick = () => {
		dialogProto = b.dataset.proto;
		document.querySelectorAll(".seg-btn").forEach((x) =>
			x.classList.toggle("active", x === b),
		);
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
			if (!/^[^:]+:[^:]+$/.test(ba)) {
				$("dialog-error").textContent = "Basic Auth must be user:pass.";
				return;
			}
			opts.basicAuth = ba;
		}
	}
	const r = await window.osm.startTunnel(opts);
	if (!r.ok) {
		$("dialog-error").textContent = r.error || "Could not start tunnel.";
		return;
	}
	expanded.add(dialogPort);
	closeDialog();
};

// auto-refresh ports every 5s
setInterval(() => {
	if (!$("screen-main").classList.contains("hidden")) refreshPorts();
}, 5000);

init();
