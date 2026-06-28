package ar.gob.chubut.sigpip.inspecciones;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

@CapacitorPlugin(name = "MockLocation")
public class MockLocationPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        boolean mockAppSet = isMockAppSelected();
        boolean lastKnownMock = anyLastKnownMock();
        boolean legacyMockSetting = legacyMockLocationEnabled();

        boolean isMocked = mockAppSet || lastKnownMock || legacyMockSetting;

        JSObject ret = new JSObject();
        ret.put("pluginWorks", true);
        ret.put("isMocked", isMocked);
        // diagnóstico — para saber QUÉ disparó la detección
        ret.put("mockAppSet", mockAppSet);
        ret.put("lastKnownMock", lastKnownMock);
        ret.put("legacyMockSetting", legacyMockSetting);
        call.resolve(ret);
    }

    // ── Señal 1 (la más fuerte): ¿hay alguna app NO-sistema con el permiso de
    // ubicación simulada concedido? Es decir, está seleccionada en Opciones de
    // desarrollador → "Seleccionar app de ubicación simulada". Se detecta al
    // instante, sin necesidad de obtener una ubicación. ──
    private boolean isMockAppSelected() {
        try {
            Context ctx = getContext();
            AppOpsManager appOps = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            PackageManager pm = ctx.getPackageManager();
            List<ApplicationInfo> apps = pm.getInstalledApplications(0);
            for (ApplicationInfo app : apps) {
                boolean isSystem = (app.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
                if (isSystem) continue;
                if (app.packageName.equals(ctx.getPackageName())) continue;
                int mode;
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        mode = appOps.unsafeCheckOpNoThrow("android:mock_location", app.uid, app.packageName);
                    } else {
                        mode = appOps.checkOpNoThrow("android:mock_location", app.uid, app.packageName);
                    }
                } catch (Exception e) { continue; }
                if (mode == AppOpsManager.MODE_ALLOWED) {
                    return true;
                }
            }
        } catch (Exception e) { /* si falla, no bloqueamos por esta vía */ }
        return false;
    }

    // ── Señal 2: la última ubicación conocida de cualquier proveedor está
    // marcada como simulada por el sistema operativo. ──
    private boolean anyLastKnownMock() {
        try {
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            String[] providers = {
                LocationManager.GPS_PROVIDER,
                LocationManager.NETWORK_PROVIDER,
                LocationManager.PASSIVE_PROVIDER
            };
            for (String p : providers) {
                Location loc;
                try { loc = lm.getLastKnownLocation(p); } catch (SecurityException e) { continue; }
                if (loc == null) continue;
                boolean mock;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    mock = loc.isMock();
                } else {
                    //noinspection deprecation
                    mock = loc.isFromMockProvider();
                }
                if (mock) return true;
            }
        } catch (Exception e) { /* ignore */ }
        return false;
    }

    // ── Señal 3 (Android viejo, ≤4.2): el ajuste global de mock locations. ──
    @SuppressWarnings("deprecation")
    private boolean legacyMockLocationEnabled() {
        try {
            if (Build.VERSION.SDK_INT > Build.VERSION_CODES.JELLY_BEAN_MR1) return false;
            String val = Settings.Secure.getString(
                getContext().getContentResolver(),
                Settings.Secure.ALLOW_MOCK_LOCATION);
            return val != null && !val.equals("0");
        } catch (Exception e) { return false; }
    }
}
