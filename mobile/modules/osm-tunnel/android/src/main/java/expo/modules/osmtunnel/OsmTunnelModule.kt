package expo.modules.osmtunnel

import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OsmTunnelModule : Module() {
	override fun definition() = ModuleDefinition {
		Name("OsmTunnel")
		Events("log", "status")

		OnCreate { instance = this@OsmTunnelModule }
		OnDestroy { if (instance === this@OsmTunnelModule) instance = null }

		Function("getToken") { prefs().getString("token", "") ?: "" }
		Function("setToken") { token: String ->
			prefs().edit().putString("token", token).apply()
		}
		Function("clearToken") { prefs().edit().remove("token").apply() }

		AsyncFunction("start") { opts: Map<String, Any?> ->
			val ctx = ctx()
			val i = Intent(ctx, TunnelService::class.java)
			i.putExtra("proto", opts["proto"] as? String ?: "http")
			i.putExtra("port", (opts["port"] as? Number)?.toInt() ?: 0)
			i.putExtra("token", opts["token"] as? String ?: "")
			i.putExtra("api", opts["api"] as? String ?: "https://api.osmrouter.com")
			i.putExtra("subdomain", opts["subdomain"] as? String ?: "")
			i.putExtra("basicAuth", opts["basicAuth"] as? String ?: "")
			i.putExtra("domain", opts["domain"] as? String ?: "")
			if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i)
			else ctx.startService(i)
		}

		AsyncFunction("stop") {
			val ctx = ctx()
			ctx.stopService(Intent(ctx, TunnelService::class.java))
		}
	}

	fun fireLog(line: String) = sendEvent("log", mapOf("line" to line))
	fun fireStatus(status: String, url: String?, error: String?) =
		sendEvent("status", mapOf("status" to status, "url" to url, "error" to error))

	private fun ctx(): Context = appContext.reactContext!!
	private fun prefs() = ctx().getSharedPreferences("osm", Context.MODE_PRIVATE)

	companion object {
		@Volatile
		var instance: OsmTunnelModule? = null
	}
}
