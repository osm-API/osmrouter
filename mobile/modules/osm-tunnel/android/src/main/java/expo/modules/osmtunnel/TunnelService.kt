package expo.modules.osmtunnel

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import java.io.BufferedReader
import java.io.InputStreamReader

class TunnelService : Service() {
	@Volatile private var process: Process? = null
	@Volatile private var reader: Thread? = null
	private val channelId = "osm_tunnel"

	override fun onBind(intent: Intent?): IBinder? = null

	override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
		startForeground(1, buildNotification())
		if (intent != null) {
			// Tear down any previous tunnel before starting a fresh one.
			killProcess()
			runTunnel(intent)
		}
		return START_NOT_STICKY
	}

	private fun killProcess() {
		try {
			process?.destroyForcibly()
		} catch (_: Exception) {
		}
		process = null
		reader?.interrupt()
		reader = null
	}

	private fun runTunnel(intent: Intent) {
		val proto = intent.getStringExtra("proto") ?: "http"
		val port = intent.getIntExtra("port", 0)
		val bin = applicationInfo.nativeLibraryDir + "/libosmrouter.so"

		val pb = ProcessBuilder(bin, proto, port.toString())
		pb.redirectErrorStream(true)
		val env = pb.environment()
		env["OSM_TOKEN"] = intent.getStringExtra("token") ?: ""
		env["OSM_API"] = intent.getStringExtra("api") ?: "https://api.osmrouter.com"
		intent.getStringExtra("domain")?.takeIf { it.isNotEmpty() }
			?.let { env["OSM_DOMAIN"] = it }
		if (proto == "http") {
			intent.getStringExtra("subdomain")?.takeIf { it.isNotEmpty() }
				?.let { env["OSM_SUBDOMAIN"] = it }
			intent.getStringExtra("basicAuth")?.takeIf { it.isNotEmpty() }
				?.let { env["OSM_BASIC_AUTH"] = it }
		}

		OsmTunnelModule.instance?.fireStatus("connecting", null, null)

		reader = Thread {
			try {
				val p = pb.start()
				process = p
				val out = BufferedReader(InputStreamReader(p.inputStream))
				val forwarding = Regex("Forwarding\\s+(\\S+)")
				var line: String?
				while (out.readLine().also { line = it } != null) {
					val l = line!!.trim()
					if (l.isEmpty()) continue
					val m = forwarding.find(l)
					when {
						m != null -> OsmTunnelModule.instance?.fireStatus("online", m.groupValues[1], null)
						l.startsWith("error:") ->
							OsmTunnelModule.instance?.fireStatus("error", null, l.removePrefix("error:").trim())
						l.contains("tunnel online") || l.contains("Press Ctrl") ||
							l.startsWith("Protected") || l == "Requests" -> {}
						else -> OsmTunnelModule.instance?.fireLog(l)
					}
				}
				val code = p.waitFor()
				OsmTunnelModule.instance?.fireStatus(
					"stopped", null, if (code != 0) "exited (code $code)" else null,
				)
			} catch (e: Exception) {
				OsmTunnelModule.instance?.fireStatus("error", null, e.message)
			}
		}
		reader?.start()
	}

	override fun onDestroy() {
		killProcess()
		OsmTunnelModule.instance?.fireStatus("stopped", null, null)
		super.onDestroy()
	}

	private fun buildNotification(): Notification {
		if (Build.VERSION.SDK_INT >= 26) {
			val ch = NotificationChannel(
				channelId, "osmRouter tunnel", NotificationManager.IMPORTANCE_LOW,
			)
			(getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
				.createNotificationChannel(ch)
		}
		val builder = if (Build.VERSION.SDK_INT >= 26)
			Notification.Builder(this, channelId) else Notification.Builder(this)
		return builder
			.setContentTitle("osmRouter")
			.setContentText("Tunnel running")
			.setSmallIcon(android.R.drawable.stat_sys_upload)
			.setOngoing(true)
			.build()
	}
}
