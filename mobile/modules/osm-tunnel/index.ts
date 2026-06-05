import { getNativeModule, StartParams } from "./src/OsmTunnelModule";

export type StartOpts = {
	proto: "http" | "tcp";
	port: number;
	token: string;
	api: string;
	subdomain?: string;
	basicAuth?: string;
	domain?: string;
};

const UNAVAILABLE = "Tunnel engine isn't available in this build.";

export function isAvailable(): boolean {
	return getNativeModule() != null;
}

export function getToken(): Promise<string> {
	const m = getNativeModule();
	if (!m) return Promise.resolve("");
	try {
		return Promise.resolve(m.getToken());
	} catch {
		return Promise.resolve("");
	}
}

export function setToken(token: string): Promise<void> {
	getNativeModule()?.setToken(token);
	return Promise.resolve();
}

export function clearToken(): Promise<void> {
	getNativeModule()?.clearToken();
	return Promise.resolve();
}

export function start(opts: StartOpts): Promise<void> {
	const m = getNativeModule();
	if (!m) return Promise.reject(new Error(UNAVAILABLE));
	const params: StartParams = {
		proto: opts.proto,
		port: opts.port,
		token: opts.token,
		api: opts.api,
		subdomain: opts.subdomain ?? "",
		basicAuth: opts.basicAuth ?? "",
		domain: opts.domain ?? "",
	};
	return m.start(params);
}

export function stop(): Promise<void> {
	const m = getNativeModule();
	if (!m) return Promise.resolve();
	return m.stop();
}

type Sub = { remove: () => void };
const noopSub: Sub = { remove: () => {} };

export function addLogListener(cb: (e: { line: string }) => void): Sub {
	const m = getNativeModule();
	if (!m) return noopSub;
	try {
		return m.addListener("log", cb);
	} catch {
		return noopSub;
	}
}

export function addStatusListener(
	cb: (e: { status: string; url?: string; error?: string }) => void,
): Sub {
	const m = getNativeModule();
	if (!m) return noopSub;
	try {
		return m.addListener("status", cb);
	} catch {
		return noopSub;
	}
}
