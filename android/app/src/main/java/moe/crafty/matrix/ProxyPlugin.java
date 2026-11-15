package moe.crafty.matrix;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

/**
 * Settings > General > Network (ZamProxy). Same shape as the desktop bridge
 * (window.desktop.proxy), plus which modes this platform offers; the page
 * adapts it in src/lib/proxyBridge.ts.
 */
@CapacitorPlugin(name = "Proxy")
public class ProxyPlugin extends Plugin {

    private JSObject info() {
        ZamProxy.Prefs p = ZamProxy.prefs();
        JSObject ret = new JSObject();
        ret.put("mode", p.mode);
        ret.put("rules", p.rules);
        ret.put("bypass", p.bypass);
        ret.put("pacUrl", "");
        ret.put("calls", p.calls);
        ret.put("launchFlags", new JSArray());
        JSArray hosts = new JSArray();
        for (String h : ZamProxy.directHosts()) hosts.put(h);
        ret.put("callBypassAddresses", hosts);
        ret.put("callBypassAvailable", !"system".equals(p.mode));
        String err = ZamProxy.lastError();
        ret.put("error", err == null ? JSObject.NULL : err);
        ret.put("supported", ZamProxy.supported());
        JSArray modes = new JSArray();
        modes.put("system");
        modes.put("direct");
        modes.put("manual");
        ret.put("modes", modes);
        JSArray callModes = new JSArray();
        callModes.put("default");
        callModes.put("direct");
        ret.put("callModes", callModes);
        return ret;
    }

    @PluginMethod
    public void info(PluginCall call) {
        call.resolve(info());
    }

    @PluginMethod
    public void set(PluginCall call) {
        ZamProxy.Prefs next = new ZamProxy.Prefs(
                call.getString("mode", "system"),
                call.getString("rules", ""),
                call.getString("bypass", ""),
                call.getString("calls", "default"));
        ZamProxy.set(next);
        call.resolve(info());
    }

    @PluginMethod
    public void callTargets(PluginCall call) {
        List<String> hosts = new ArrayList<>();
        JSONArray arr = call.getArray("hosts");
        if (arr != null) {
            for (int i = 0; i < arr.length(); i++) {
                String h = arr.optString(i, null);
                if (h != null) hosts.add(h);
            }
        }
        ZamProxy.addCallTargets(hosts);
        call.resolve();
    }
}
