// Open a tunnel from Node and print the public URL.
//
//   npm install @omsapi/osmrouter
//   OSM_TOKEN=osm_xxxxx node basic.mjs
//
// A local server must be listening on PORT (default 8080).

import { connect } from "@omsapi/osmrouter";

const port = Number(process.env.PORT || 8080);

const tunnel = await connect({
	port,
	token: process.env.OSM_TOKEN,
	// subdomain: "my-app", // optional — pin a stable hostname
});

console.log(`Public URL: ${tunnel.url}  ->  http://localhost:${port}`);
console.log("Press Ctrl+C to stop.");

process.on("SIGINT", async () => {
	await tunnel.close();
	process.exit(0);
});
