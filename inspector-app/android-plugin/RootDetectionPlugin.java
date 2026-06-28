package ar.gob.chubut.sigpip.inspecciones;

import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "RootDetection")
public class RootDetectionPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        boolean isRooted = checkSuBinary()
                || checkRootPackages()
                || checkWritableSystem()
                || checkBuildTags();

        JSObject ret = new JSObject();
        ret.put("isRooted", isRooted);
        call.resolve(ret);
    }

    // Busca binarios 'su' en rutas conocidas
    private boolean checkSuBinary() {
        String[] paths = {
            "/system/bin/su", "/system/xbin/su", "/sbin/su",
            "/system/su", "/system/bin/.ext/.su", "/system/usr/we-need-root/su-backup",
            "/data/local/su", "/data/local/xbin/su", "/data/local/bin/su",
            "/system/sd/xbin/su", "/system/bin/failsafe/su", "/su/bin/su"
        };
        for (String path : paths) {
            if (new File(path).exists()) return true;
        }
        return false;
    }

    // Detecta apps de root conocidas
    private boolean checkRootPackages() {
        String[] rootPackages = {
            "com.noshufou.android.su", "com.noshufou.android.su.elite",
            "eu.chainfire.supersu", "com.koushikdutta.superuser",
            "com.thirdparty.superuser", "com.yellowes.su",
            "com.topjohnwu.magisk", "com.kingroot.kinguser",
            "com.kingo.root", "com.smedialink.oneclickroot",
            "com.zhiqupk.root.global", "com.alephzain.framaroot"
        };
        PackageManager pm = getContext().getPackageManager();
        for (String pkg : rootPackages) {
            try {
                pm.getPackageInfo(pkg, 0);
                return true;
            } catch (PackageManager.NameNotFoundException ignored) {}
        }
        return false;
    }

    // Intenta escribir en /system (solo posible con root)
    private boolean checkWritableSystem() {
        try {
            Process p = Runtime.getRuntime().exec(new String[]{ "mount" });
            byte[] buf = new byte[1024];
            int read = p.getInputStream().read(buf);
            String out = read > 0 ? new String(buf, 0, read) : "";
            // Si /system aparece montado como rw, está rooteado
            return out.contains("/system") && out.contains(" rw,");
        } catch (Exception e) { return false; }
    }

    // Los ROMs rooteados suelen tener build tags de 'test-keys'
    private boolean checkBuildTags() {
        String tags = Build.TAGS;
        return tags != null && tags.contains("test-keys");
    }
}
