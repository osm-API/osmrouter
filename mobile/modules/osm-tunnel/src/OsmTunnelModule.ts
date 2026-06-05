import { NativeModule, requireNativeModule } from "expo";

export type OsmTunnelEvents = {
	log: (params: { line: string }) => void;
	status: (params: { status: string; url?: string; error?: string }) => void;
};

export type StartParams = {
	proto: string;
	port: number;
	token: string;
	api: string;
	subdomain: string;
	basicAuth: string;
	domain?: string;
};

export declare class OsmTunnelModule extends NativeModule<OsmTunnelEvents> {
	getToken(): string;
	setToken(token: string): void;
	clearToken(): void;
	start(opts: StartParams): Promise<void>;
	stop(): Promise<void>;
}

// Resolve lazily. A top-level requireNativeModule() that throws would blank the
// whole app at import time (white screen) before React ever renders. By
// deferring resolution into a guarded getter, the UI always mounts and any
// problem surfaces as an in-app message instead.
let cached: OsmTunnelModule | null = null;
let resolved = false;

export function getNativeModule(): OsmTunnelModule | null {
	if (resolved) return cached;
	resolved = true;
	try {
		cached = requireNativeModule<OsmTunnelModule>("OsmTunnel");
	} catch {
		cached = null;
	}
	return cached;
}
