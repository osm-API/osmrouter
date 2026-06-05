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

declare class OsmTunnelModule extends NativeModule<OsmTunnelEvents> {
	getToken(): string;
	setToken(token: string): void;
	clearToken(): void;
	start(opts: StartParams): Promise<void>;
	stop(): Promise<void>;
}

export default requireNativeModule<OsmTunnelModule>("OsmTunnel");
