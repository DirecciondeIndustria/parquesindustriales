package ar.gob.chubut.sigpip.inspecciones;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MockLocationPlugin.class);   // detección fake GPS
        registerPlugin(RootDetectionPlugin.class); // detección root/jailbreak
        super.onCreate(savedInstanceState);
    }
}
