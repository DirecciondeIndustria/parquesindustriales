package ar.gob.chubut.sigpip.inspecciones;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
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
        JSObject ret = new JSObject();
        ret.put("isMocked", hasMockLocationApp());
        call.resolve(ret);
    }

    private boolean hasMockLocationApp() {
        PackageManager pm = getContext().getPackageManager();
        try {
            List<ApplicationInfo> apps;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                apps = pm.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(0));
            } else {
                apps = pm.getInstalledApplications(0);
            }
            for (ApplicationInfo app : apps) {
                boolean esSistema = (app.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
                if (esSistema) continue;
                int perm = pm.checkPermission(
                    "android.permission.ACCESS_MOCK_LOCATION",
                    app.packageName
                );
                if (perm == PackageManager.PERMISSION_GRANTED) return true;
            }
        } catch (Exception e) {
            // Si falla la detección, no bloqueamos
        }
        return false;
    }
}
