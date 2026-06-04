import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Linking,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import * as Tunnel from "./modules/osm-tunnel";

const API = "https://api.osmrouter.com";
const DASH = "https://app.osmrouter.com";

const C = {
	bg: "#0a0a0a",
	surface: "#151515",
	surfaceHi: "#1d1d1d",
	line: "#272727",
	ink: "#fafafa",
	muted: "#9a9a9a",
	faint: "#6a6a6a",
	brand: "#ffd95a",
	brandInk: "#1a1505",
	ok: "#34d058",
	err: "#ff6b6b",
};

export default function App() {
	const [token, setToken] = useState(null); // null=loading, ""=none, "osm_…"=set
	const [input, setInput] = useState("");
	const [account, setAccount] = useState(null);
	const [error, setError] = useState("");
	const [connecting, setConnecting] = useState(false);

	// tunnel form
	const [port, setPort] = useState("8080");
	const [proto, setProto] = useState("http");
	const [subdomain, setSubdomain] = useState("");
	const [basicAuth, setBasicAuth] = useState("");

	// tunnel state
	const [status, setStatus] = useState("idle"); // idle|connecting|online|error
	const [url, setUrl] = useState("");
	const [logs, setLogs] = useState([]);
	const logRef = useRef(null);

	useEffect(() => {
		Tunnel.getToken().then((t) => setToken(t || ""));
		const s = Tunnel.addStatusListener((e) => {
			setStatus(e.status);
			if (e.url) setUrl(e.url);
			if (e.error) setError(e.error);
		});
		const l = Tunnel.addLogListener((e) => {
			setLogs((prev) => [...prev.slice(-300), e.line]);
		});
		return () => {
			s.remove();
			l.remove();
		};
	}, []);

	async function connect() {
		setError("");
		setConnecting(true);
		try {
			const res = await fetch(`${API}/v1/agent/me`, {
				headers: { authorization: `Bearer ${input.trim()}` },
			});
			if (!res.ok) throw new Error("That token is invalid or revoked.");
			const acct = await res.json();
			await Tunnel.setToken(input.trim());
			setAccount(acct);
			setToken(input.trim());
		} catch (e) {
			setError(e.message || "Could not validate token.");
		} finally {
			setConnecting(false);
		}
	}

	async function disconnect() {
		await Tunnel.stop().catch(() => {});
		await Tunnel.clearToken();
		setToken("");
		setInput("");
		setStatus("idle");
		setUrl("");
		setLogs([]);
	}

	async function startTunnel() {
		setError("");
		setUrl("");
		setLogs([]);
		setStatus("connecting");
		const p = parseInt(port, 10);
		if (!p || p < 1 || p > 65535) {
			setStatus("idle");
			return setError("Enter a valid port (1–65535).");
		}
		try {
			await Tunnel.start({
				proto,
				port: p,
				token,
				api: API,
				subdomain: proto === "http" ? subdomain.trim() : "",
				basicAuth: proto === "http" ? basicAuth.trim() : "",
			});
		} catch (e) {
			setStatus("error");
			setError(e.message || "Could not start tunnel.");
		}
	}

	async function stopTunnel() {
		await Tunnel.stop().catch(() => {});
		setStatus("idle");
		setUrl("");
	}

	// ---------- loading ----------
	if (token === null) {
		return (
			<View style={[s.screen, s.center]}>
				<StatusBar style="light" />
				<ActivityIndicator color={C.brand} />
			</View>
		);
	}

	// ---------- connect ----------
	if (!token) {
		return (
			<ScrollView style={s.screen} contentContainerStyle={s.connectWrap}>
				<StatusBar style="light" />
				<View style={s.brandRow}>
					<View style={s.dot} />
					<Text style={s.brandText}>osmRouter</Text>
				</View>
				<Text style={s.h1}>Connect your account</Text>
				<Text style={s.muted}>
					Paste your agent token to expose a port on this device at a public URL.
				</Text>
				<Text style={s.label}>Agent token</Text>
				<TextInput
					style={s.input}
					value={input}
					onChangeText={setInput}
					placeholder="osm_xxxxxxxx"
					placeholderTextColor={C.faint}
					autoCapitalize="none"
					autoCorrect={false}
					secureTextEntry
				/>
				{!!error && <Text style={s.error}>{error}</Text>}
				<Pressable style={s.primary} onPress={connect} disabled={connecting}>
					{connecting ? (
						<ActivityIndicator color={C.brandInk} />
					) : (
						<Text style={s.primaryText}>Connect</Text>
					)}
				</Pressable>
				<Pressable onPress={() => Linking.openURL(DASH)}>
					<Text style={s.linkMuted}>
						No token? Open the dashboard → Tokens ↗
					</Text>
				</Pressable>
			</ScrollView>
		);
	}

	// ---------- main ----------
	const online = status === "online";
	const busy = status === "connecting";
	return (
		<ScrollView style={s.screen} contentContainerStyle={{ padding: 18 }}>
			<StatusBar style="light" />
			<View style={s.topRow}>
				<View style={s.brandRow}>
					<View style={s.dot} />
					<Text style={s.brandText}>osmRouter</Text>
				</View>
				<Pressable onPress={disconnect}>
					<Text style={s.linkMuted}>Disconnect</Text>
				</Pressable>
			</View>
			{!!account && (
				<Text style={[s.muted, { marginBottom: 16 }]}>
					{account.email} · {account.plan}
				</Text>
			)}

			{/* form */}
			<View style={s.card}>
				<Text style={s.cardTitle}>Expose a port</Text>
				<View style={s.seg}>
					{["http", "tcp"].map((p) => (
						<Pressable
							key={p}
							style={[s.segBtn, proto === p && s.segActive]}
							onPress={() => setProto(p)}
							disabled={online || busy}
						>
							<Text style={[s.segText, proto === p && s.segTextActive]}>
								{p.toUpperCase()}
							</Text>
						</Pressable>
					))}
				</View>
				<Text style={s.label}>Local port</Text>
				<TextInput
					style={s.input}
					value={port}
					onChangeText={setPort}
					keyboardType="number-pad"
					placeholder="8080"
					placeholderTextColor={C.faint}
					editable={!online && !busy}
				/>
				{proto === "http" && (
					<>
						<Text style={s.label}>Subdomain (optional)</Text>
						<TextInput
							style={s.input}
							value={subdomain}
							onChangeText={setSubdomain}
							placeholder="my-app"
							placeholderTextColor={C.faint}
							autoCapitalize="none"
							editable={!online && !busy}
						/>
						<Text style={s.label}>Basic Auth (optional, user:pass)</Text>
						<TextInput
							style={s.input}
							value={basicAuth}
							onChangeText={setBasicAuth}
							placeholder="alice:s3cret"
							placeholderTextColor={C.faint}
							autoCapitalize="none"
							editable={!online && !busy}
						/>
					</>
				)}
				{!!error && <Text style={s.error}>{error}</Text>}
				{online ? (
					<Pressable style={s.outline} onPress={stopTunnel}>
						<Text style={s.outlineText}>Stop tunnel</Text>
					</Pressable>
				) : (
					<Pressable style={s.primary} onPress={startTunnel} disabled={busy}>
						{busy ? (
							<ActivityIndicator color={C.brandInk} />
						) : (
							<Text style={s.primaryText}>Start tunnel</Text>
						)}
					</Pressable>
				)}
			</View>

			{/* status / url */}
			{(online || busy || url) && (
				<View style={s.card}>
					<View style={s.statusRow}>
						<View
							style={[
								s.statusDot,
								{ backgroundColor: online ? C.ok : C.brand },
							]}
						/>
						<Text style={s.statusText}>
							{online ? "Online" : busy ? "Connecting…" : status}
						</Text>
					</View>
					{!!url && (
						<Pressable
							onPress={() =>
								url.startsWith("http") && Linking.openURL(url)
							}
						>
							<Text style={s.url}>{url}</Text>
						</Pressable>
					)}
				</View>
			)}

			{/* logs */}
			{logs.length > 0 && (
				<View style={s.card}>
					<Text style={s.cardTitle}>Live requests</Text>
					<ScrollView
						ref={logRef}
						style={s.logs}
						onContentSizeChange={() =>
							logRef.current?.scrollToEnd({ animated: true })
						}
					>
						{logs.map((l, i) => (
							<Text key={i} style={s.logLine}>
								{l}
							</Text>
						))}
					</ScrollView>
				</View>
			)}
		</ScrollView>
	);
}

const s = StyleSheet.create({
	screen: { flex: 1, backgroundColor: C.bg },
	center: { alignItems: "center", justifyContent: "center" },
	connectWrap: { padding: 24, paddingTop: 90 },
	brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
	dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand },
	brandText: { color: C.ink, fontWeight: "700", fontSize: 16 },
	h1: { color: C.ink, fontSize: 24, fontWeight: "600", marginTop: 18 },
	muted: { color: C.muted, marginTop: 6, lineHeight: 20 },
	label: { color: C.muted, fontSize: 12, marginTop: 18, marginBottom: 6 },
	input: {
		backgroundColor: C.bg,
		borderWidth: 1,
		borderColor: C.line,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 11,
		color: C.ink,
		fontSize: 15,
	},
	error: { color: C.err, marginTop: 8 },
	primary: {
		backgroundColor: C.brand,
		borderRadius: 10,
		paddingVertical: 13,
		alignItems: "center",
		marginTop: 16,
	},
	primaryText: { color: C.brandInk, fontWeight: "700", fontSize: 15 },
	outline: {
		borderWidth: 1,
		borderColor: C.line,
		borderRadius: 10,
		paddingVertical: 13,
		alignItems: "center",
		marginTop: 16,
	},
	outlineText: { color: C.ink, fontWeight: "600", fontSize: 15 },
	linkMuted: { color: C.muted, marginTop: 18, textAlign: "center" },
	topRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: 36,
	},
	card: {
		backgroundColor: C.surface,
		borderWidth: 1,
		borderColor: C.line,
		borderRadius: 14,
		padding: 16,
		marginBottom: 14,
	},
	cardTitle: { color: C.ink, fontWeight: "600", fontSize: 15, marginBottom: 12 },
	seg: { flexDirection: "row", gap: 6, marginBottom: 4 },
	segBtn: {
		flex: 1,
		borderWidth: 1,
		borderColor: C.line,
		borderRadius: 9,
		paddingVertical: 9,
		alignItems: "center",
		backgroundColor: C.surfaceHi,
	},
	segActive: { backgroundColor: C.brand, borderColor: C.brand },
	segText: { color: C.muted, fontWeight: "600" },
	segTextActive: { color: C.brandInk },
	statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	statusDot: { width: 8, height: 8, borderRadius: 4 },
	statusText: { color: C.ink, fontWeight: "600" },
	url: {
		color: C.brand,
		fontFamily: "monospace",
		marginTop: 10,
		fontSize: 13,
	},
	logs: {
		backgroundColor: "#060606",
		borderRadius: 9,
		padding: 10,
		maxHeight: 240,
	},
	logLine: {
		color: "#cfcfcf",
		fontFamily: "monospace",
		fontSize: 11,
		lineHeight: 17,
	},
});
