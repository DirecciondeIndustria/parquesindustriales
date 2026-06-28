package ar.gob.chubut.sigpip.inspecciones;

import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MockLocation")
public class MockLocationPlugin extends Plugin {

    @PluginMethod
    public void check(final PluginCall call) {
        LocationManager lm = (LocationManager) getContext()
            .getSystemService(android.content.Context.LOCATION_SERVICE);

        // Primero intentar con la última ubicación conocida (rápido)
        String[] providers = { LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER };
        for (String provider : providers) {
            try {
                Location loc = lm.getLastKnownLocation(provider);
                if (loc != null) {
                    resolveWithLocation(call, loc);
                    return;
                }
            } catch (SecurityException ignored) {}
        }

        // Sin ubicación en caché: pedir una fresca de GPS con timeout de 8 segundos
        Handler handler = new Handler(Looper.getMainLooper());
        final boolean[] resolved = { false };

        LocationListener listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (resolved[0]) return;
                resolved[0] = true;
                try { lm.removeUpdates(this); } catch (SecurityException ignored) {}
                handler.removeCallbacksAndMessages(null);
                resolveWithLocation(call, location);
            }
            @Override public void onStatusChanged(String p, int s, Bundle e) {}
            @Override public void onProviderEnabled(String p) {}
            @Override public void onProviderDisabled(String p) {}
        };

        handler.postDelayed(() -> {
            if (resolved[0]) return;
            resolved[0] = true;
            try { lm.removeUpdates(listener); } catch (SecurityException ignored) {}
            // Timeout sin ubicación: no bloqueamos para no perjudicar inspectores sin señal
            JSObject ret = new JSObject();
            ret.put("isMocked", false);
            call.resolve(ret);
        }, 8000);

        // Intentar GPS primero (es el provider que fakeean), luego NETWORK
        boolean requested = false;
        for (String provider : new String[]{ LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER }) {
            try {
                if (lm.isProviderEnabled(provider)) {
                    lm.requestSingleUpdate(provider, listener, Looper.getMainLooper());
                    requested = true;
                    break;
                }
            } catch (SecurityException ignored) {}
        }
        if (!requested) {
            resolved[0] = true;
            JSObject ret = new JSObject();
            ret.put("isMocked", false);
            call.resolve(ret);
        }
    }

    private void resolveWithLocation(PluginCall call, Location loc) {
        boolean mocked;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            mocked = loc.isMock();
        } else {
            //noinspection deprecation
            mocked = loc.isFromMockProvider();
        }
        JSObject ret = new JSObject();
        ret.put("isMocked", mocked);
        call.resolve(ret);
    }
}
