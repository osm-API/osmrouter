import { EventEmitter, requireNativeModule } from "expo-modules-core";

const M = requireNativeModule("OsmTunnel");
const emitter = new EventEmitter(M);

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
	return M.getToken();
}
export function setToken(t: string): Promise<void> {
	return M.setToken(t);
}
export function clearToken(): Promise<void> {
	return M.clearToken();
}
export function start(opts: StartOpts): Promise<void> {
	return M.start(opts);
}
export function stop(): Promise<void> {
	return M.stop();
}
export function addLogListener(cb: (e: { line: string }) => void) {
	return emitter.addListener("log", cb);
}
export function addStatusListener(
	cb: (e: { status: string; url?: string; error?: string }) => void,
) {
	return emitter.addListener("status", cb);
}
