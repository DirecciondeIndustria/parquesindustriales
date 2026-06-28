package ar.gob.chubut.sigpip.inspecciones;

import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "MockLocation")
public class MockLocationPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        // Señal AUTORITATIVA: pedimos una ubicación real fresca y le preguntamos
        // al SO si ESA lectura proviene de un proveedor simulado. Solo da true
        // cuando hay un GPS falso ENTREGANDO ubicación en este momento. No tiene
        // falsos positivos (a diferencia de escanear AppOps de todas las apps).
        Boolean freshMock = requestFreshMock(8000);

        // Señal secundaria de respaldo: última ubicación conocida marcada como mock.
        boolean lastKnownMock = anyLastKnownMock();

        // Android viejo (≤4.2): ajuste global de mock locations.
        boolean legacyMockSetting = legacyMockLocationEnabled();

        // Decisión: bloqueamos SOLO si una lectura confirmada es simulada.
        // Si no pudimos obtener una lectura fresca (freshMock == null), NO
        // bloqueamos por esa vía (evita falsos positivos a inspectores reales).
        boolean freshIsMock = (freshMock != null && freshMock);
        boolean isMocked = freshIsMock || legacyMockSetting;

        JSObject ret = new JSObject();
        ret.put("pluginWorks", true);
        ret.put("isMocked", isMocked);
        // diagnóstico
        ret.put("freshMock", freshMock == null ? "sin_lectura" : String.valueOf(freshMock));
        ret.put("lastKnownMock", lastKnownMock);
        ret.put("legacyMockSetting", legacyMockSetting);
        call.resolve(ret);
    }

    // ── Pide actualizaciones de ubicación reales y revisa isMock() en la primera
    // lectura. Devuelve true/false según la lectura, o null si no llegó ninguna
    // dentro del timeout. ──
    private Boolean requestFreshMock(long timeoutMs) {
        final LocationManager lm =
            (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return null;

        final CountDownLatch latch = new CountDownLatch(1);
        final boolean[] result = { false };
        final boolean[] got = { false };

        final LocationListener listener = new LocationListener() {
            @Override public void onLocationChanged(Location loc) {
                if (loc == null || got[0]) return;
                boolean mock;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    mock = loc.isMock();
                } else {
                    //noinspection deprecation
                    mock = loc.isFromMockProvider();
                }
                result[0] = mock;
                got[0] = true;
                latch.countDown();
            }
            @Override public void onStatusChanged(String p, int s, Bundle b) {}
            @Override public void onProviderEnabled(String p) {}
            @Override public void onProviderDisabled(String p) {}
        };

        boolean requested = false;
        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER, 0, 0, listener, Looper.getMainLooper());
                requested = true;
            }
        } catch (SecurityException e) { return null; }
          catch (Exception e) { /* ignore */ }
        try {
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER, 0, 0, listener, Looper.getMainLooper());
                requested = true;
            }
        } catch (SecurityException e) { /* ya pedimos GPS */ }
          catch (Exception e) { /* ignore */ }

        if (!requested) return null;

        try {
            latch.await(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) { /* ignore */ }

        try { lm.removeUpdates(listener); } catch (Exception e) { /* ignore */ }

        if (!got[0]) return null;
        return result[0];
    }

    // ── Respaldo: última ubicación conocida marcada como simulada. ──
    private boolean anyLastKnownMock() {
        try {
            LocationManager lm =
                (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            String[] providers = {
                LocationManager.GPS_PROVIDER,
                LocationManager.NETWORK_PROVIDER
            };
            for (String p : providers) {
                Location loc;
                try { loc = lm.getLastKnownLocation(p); }
                catch (SecurityException e) { continue; }
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

    // ── Android viejo (≤4.2): ajuste global de mock locations. ──
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
