package ar.gob.chubut.sigpip.inspecciones

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "MockLocation")
class MockLocationPlugin : Plugin() {

    @PluginMethod
    fun check(call: PluginCall) {
        val ret = JSObject()
        ret.put("isMocked", hasMockLocationApp())
        call.resolve(ret)
    }

    // Detecta si hay alguna app instalada (no del sistema) con permiso de
    // ubicación simulada — cubre el 99% de las apps tipo "Fake GPS".
    private fun hasMockLocationApp(): Boolean {
        val pm = context.packageManager
        return try {
            val apps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getInstalledApplications(0)
            }
            apps.any { app ->
                val esAppSistema = (app.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                if (esAppSistema) return@any false
                pm.checkPermission(
                    "android.permission.ACCESS_MOCK_LOCATION",
                    app.packageName
                ) == PackageManager.PERMISSION_GRANTED
            }
        } catch (e: Exception) {
            false
        }
    }
}
