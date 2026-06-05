import OsmTunnel, { StartParams } from "./src/OsmTunnelModule";

export type StartOpts = {
	proto: "http" | "tcp";
	port: number;
	token: string;
	api: string;
	subdomain?: string;
	basicAuth?: string;
	domain?: string;
};

export function getToken(): Promise<string> {
	return Promise.resolve(OsmTunnel.getToken());
}

export function setToken(token: string): Promise<void> {
	OsmTunnel.setToken(token);
	return Promise.resolve();
}

export function clearToken(): Promise<void> {
	OsmTunnel.clearToken();
	return Promise.resolve();
}

export function start(opts: StartOpts): Promise<void> {
	const params: StartParams = {
		proto: opts.proto,
		port: opts.port,
		token: opts.token,
		api: opts.api,
		subdomain: opts.subdomain ?? "",
		basicAuth: opts.basicAuth ?? "",
		domain: opts.domain ?? "",
	};
	return OsmTunnel.start(params);
}

export function stop(): Promise<void> {
	return OsmTunnel.stop();
}

export function addLogListener(cb: (e: { line: string }) => void) {
	return OsmTunnel.addListener("log", cb);
}

export function addStatusListener(
	cb: (e: { status: string; url?: string; error?: string }) => void,
) {
	return OsmTunnel.addListener("status", cb);
}
