// Give a test a real public URL with the Node SDK.
//
//   npm install @omsapi/osmrouter vitest
//   OSM_TOKEN=osm_xxxxx npx vitest run webhook.test.mjs
//
// Opens a tunnel to a local server in beforeAll and closes it in afterAll, so a
// third-party provider (or another machine) can reach your handler during the test.

import { afterAll, beforeAll, expect, test } from "vitest";
import { createServer } from "node:http";
import { connect } from "@omsapi/osmrouter";

let server;
let tunnel;

beforeAll(async () => {
	server = createServer((req, res) => {
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify({ ok: true, path: req.url }));
	});
	await new Promise((r) => server.listen(3000, r));

	tunnel = await connect({
		port: 3000,
		token: process.env.OSM_TOKEN,
		subdomain: "ci-webhooks",
	});
});

afterAll(async () => {
	await tunnel?.close();
	await new Promise((r) => server.close(r));
});

test("a provider can reach our webhook over the public URL", async () => {
	const res = await fetch(`${tunnel.url}/health`);
	expect(res.status).toBe(200);
	const body = await res.json();
	expect(body.ok).toBe(true);
});
