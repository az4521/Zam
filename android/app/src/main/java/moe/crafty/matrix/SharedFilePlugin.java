package moe.crafty.matrix;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the web layer delete a file staged by SharedIncomingFiles once it has
 * read it. Only paths inside the staging folder are honoured.
 */
@CapacitorPlugin(name = "SharedFile")
public class SharedFilePlugin extends Plugin {

    @PluginMethod
    public void release(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("missing path");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("removed", SharedIncomingFiles.release(getContext(), path));
        call.resolve(ret);
    }
}
