package moe.crafty.matrix;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * Raw TCP and UDP sockets for plugins (zam.network; src/lib/plugins/
 * pluginSockets.ts). The Android twin of electron/pluginSockets.cjs and
 * speaks the same protocol: the page asks for a socket and gets an id; what
 * arrives on it comes back as "socketEvent" notifications. Bytes cross the
 * bridge as base64 in the "data" field.
 *
 * Plugins are full-trust code in the page, so the endpoint rules (the
 * manifest's `sockets`) are checked in the page. This side only checks the
 * request is well formed, caps the sockets per plugin, and closes sockets
 * when they are no longer wanted.
 *
 * Threads: a call never waits for the network. Connect, bind, write and send
 * run on a per-socket single-thread executor (so writes keep their order);
 * each open socket has its own reader thread that posts "data" / "message"
 * events. A socket closes once: a user close emits nothing (the page already
 * dropped it); a remote or I/O failure emits one "close" with the error.
 */
@CapacitorPlugin(name = "PluginSockets")
public class PluginSocketsPlugin extends Plugin {
    private static final String TAG = "ZamPluginSockets";
    private static final String EVENT = "socketEvent";

    private static final Pattern PLUGIN_ID = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$");
    private static final Pattern HOST = Pattern.compile("^[A-Za-z0-9.:-]{1,253}$");
    private static final int MAX_SOCKETS_PER_PLUGIN = 64;
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_BUFFER = 16 * 1024;
    private static final int UDP_BUFFER = 64 * 1024;

    private final AtomicInteger nextId = new AtomicInteger(1);
    private final Map<Integer, Entry> sockets = new ConcurrentHashMap<>();

    /** One socket, pending or open. */
    private static final class Entry {
        final int id;
        final String pluginId;
        final boolean tcp;
        final ExecutorService ops;
        final AtomicBoolean closed = new AtomicBoolean(false);
        volatile boolean ready = false;
        volatile Socket tcpSocket;
        volatile DatagramSocket udpSocket;

        Entry(int id, String pluginId, boolean tcp) {
            this.id = id;
            this.pluginId = pluginId;
            this.tcp = tcp;
            this.ops = Executors.newSingleThreadExecutor(daemon("PluginSockets-ops-" + id));
        }

        void closeQuietly() {
            try {
                if (tcpSocket != null) tcpSocket.close();
            } catch (IOException ignored) {
                // Already closed.
            }
            try {
                if (udpSocket != null) udpSocket.close();
            } catch (RuntimeException ignored) {
                // Already closed.
            }
            ops.shutdownNow();
        }
    }

    private static java.util.concurrent.ThreadFactory daemon(String name) {
        return r -> {
            Thread t = new Thread(r, name);
            t.setDaemon(true);
            return t;
        };
    }

    @Override
    public void load() {
        // A new page (reload, navigation) knows nothing of the sockets the old
        // one opened, and Capacitor drops the plugin's listeners on the same
        // event. Close them all when a page starts. Plugin instances are not
        // reused across page loads, so this is the one clean hook.
        if (getBridge() == null) return;
        getBridge()
            .addWebViewListener(
                new com.getcapacitor.WebViewListener() {
                    @Override
                    public void onPageStarted(android.webkit.WebView webView) {
                        closeAll();
                    }
                }
            );
    }

    @Override
    protected void handleOnDestroy() {
        closeAll();
        super.handleOnDestroy();
    }

    private void closeAll() {
        for (Entry e : new ArrayList<>(sockets.values())) finish(e, false, null);
    }

    /** The one place an open socket goes away. Idempotent. */
    private void finish(Entry e, boolean notifyPage, String error) {
        if (!e.closed.compareAndSet(false, true)) return;
        sockets.remove(e.id, e);
        e.closeQuietly();
        if (notifyPage) {
            JSObject ev = new JSObject();
            ev.put("id", e.id);
            ev.put("type", "close");
            ev.put("error", error == null ? JSObject.NULL : error);
            notifyListeners(EVENT, ev);
        }
    }

    private int countFor(String pluginId) {
        int n = 0;
        for (Entry e : sockets.values()) if (e.pluginId.equals(pluginId)) n++;
        return n;
    }

    /** The error for a bad plugin id, or null when it is fine. */
    private String checkPlugin(String pluginId) {
        if (pluginId == null || !PLUGIN_ID.matcher(pluginId).matches()) return "bad plugin id";
        return null;
    }

    private static boolean validPort(int port, boolean allowZero) {
        return port >= (allowZero ? 0 : 1) && port <= 65535;
    }

    private static String b64(byte[] bytes, int n) {
        return Base64.encodeToString(bytes, 0, n, Base64.NO_WRAP);
    }

    private Entry register(String pluginId, boolean tcp) {
        synchronized (sockets) {
            if (countFor(pluginId) >= MAX_SOCKETS_PER_PLUGIN) return null;
            Entry e = new Entry(nextId.getAndIncrement(), pluginId, tcp);
            sockets.put(e.id, e);
            return e;
        }
    }

    /** Remove a socket that never got going, quietly (no "close" event). */
    private void abandon(Entry e) {
        if (e == null) return;
        if (!e.closed.compareAndSet(false, true)) return;
        sockets.remove(e.id, e);
        e.closeQuietly();
    }

    @PluginMethod
    public void tcp(PluginCall call) {
        final String pluginId = call.getString("pluginId");
        final String host = call.getString("host");
        final int port = call.getInt("port", -1);
        String bad = checkPlugin(pluginId);
        if (bad != null) {
            call.reject(bad);
            return;
        }
        if (host == null || !HOST.matcher(host).matches()) {
            call.reject("bad host");
            return;
        }
        if (!validPort(port, false)) {
            call.reject("bad port");
            return;
        }
        final Entry e = register(pluginId, true);
        if (e == null) {
            call.reject("too many sockets");
            return;
        }
        try {
            e.ops.execute(() -> {
                try {
                    // Resolve the name here, off the call thread.
                    InetSocketAddress addr = new InetSocketAddress(host, port);
                    Socket socket = new Socket();
                    e.tcpSocket = socket;
                    socket.setTcpNoDelay(true);
                    socket.connect(addr, CONNECT_TIMEOUT_MS);
                    if (e.closed.get()) {
                        socket.close();
                        call.reject("socket is closed");
                        return;
                    }
                    e.ready = true;
                    JSObject ret = new JSObject();
                    ret.put("id", e.id);
                    // Resolve before the reader can post data: the page must
                    // have the id to route events to.
                    call.resolve(ret);
                    startTcpReader(e, socket);
                } catch (Exception ex) {
                    abandon(e);
                    call.reject(messageOf(ex));
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException ex) {
            abandon(e);
            call.reject("socket is closed");
        }
    }

    private void startTcpReader(Entry e, Socket socket) {
        Thread t = new Thread(() -> {
            try (InputStream in = socket.getInputStream()) {
                byte[] buf = new byte[READ_BUFFER];
                int n;
                while ((n = in.read(buf)) != -1) {
                    if (n == 0) continue;
                    JSObject ev = new JSObject();
                    ev.put("id", e.id);
                    ev.put("type", "data");
                    ev.put("data", b64(buf, n));
                    if (!e.closed.get()) notifyListeners(EVENT, ev);
                }
                // The peer closed cleanly.
                finish(e, true, null);
            } catch (IOException ex) {
                finish(e, true, messageOf(ex));
            }
        }, "PluginSockets-read-" + e.id);
        t.setDaemon(true);
        t.start();
    }

    @PluginMethod
    public void udp(PluginCall call) {
        final String pluginId = call.getString("pluginId");
        final String localHost = call.getString("localHost", "127.0.0.1");
        final int localPort = call.getInt("localPort", 0);
        String bad = checkPlugin(pluginId);
        if (bad != null) {
            call.reject(bad);
            return;
        }
        if (localHost == null || !HOST.matcher(localHost).matches()) {
            call.reject("bad host");
            return;
        }
        if (!validPort(localPort, true)) {
            call.reject("bad port");
            return;
        }
        final Entry e = register(pluginId, false);
        if (e == null) {
            call.reject("too many sockets");
            return;
        }
        try {
            e.ops.execute(() -> {
                try {
                    DatagramSocket socket = new DatagramSocket(
                        new InetSocketAddress(localHost, localPort)
                    );
                    e.udpSocket = socket;
                    if (e.closed.get()) {
                        socket.close();
                        call.reject("socket is closed");
                        return;
                    }
                    e.ready = true;
                    JSObject ret = new JSObject();
                    ret.put("id", e.id);
                    ret.put("localPort", socket.getLocalPort());
                    call.resolve(ret);
                    startUdpReader(e, socket);
                } catch (Exception ex) {
                    abandon(e);
                    call.reject(messageOf(ex));
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException ex) {
            abandon(e);
            call.reject("socket is closed");
        }
    }

    private void startUdpReader(Entry e, DatagramSocket socket) {
        Thread t = new Thread(() -> {
            byte[] buf = new byte[UDP_BUFFER];
            try {
                while (true) {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    socket.receive(p);
                    if (e.closed.get()) return;
                    JSObject ev = new JSObject();
                    ev.put("id", e.id);
                    ev.put("type", "message");
                    ev.put("host", p.getAddress().getHostAddress());
                    ev.put("port", p.getPort());
                    ev.put("data", b64(p.getData(), p.getLength()));
                    notifyListeners(EVENT, ev);
                }
            } catch (IOException ex) {
                finish(e, true, messageOf(ex));
            }
        }, "PluginSockets-udp-" + e.id);
        t.setDaemon(true);
        t.start();
    }

    /** An open socket of this plugin, or null (closed, unknown, or of the other kind). */
    private Entry open(int id, boolean tcp) {
        Entry e = sockets.get(id);
        if (e == null || !e.ready || e.tcp != tcp || e.closed.get()) return null;
        return e;
    }

    @PluginMethod
    public void write(PluginCall call) {
        final int id = call.getInt("id", -1);
        final String data = call.getString("data");
        Entry e = open(id, true);
        if (e == null) {
            call.reject("socket is closed");
            return;
        }
        if (data == null) {
            call.reject("bad data");
            return;
        }
        runOn(e, call, () -> {
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
            OutputStream out = e.tcpSocket.getOutputStream();
            out.write(bytes);
            out.flush();
        });
    }

    @PluginMethod
    public void send(PluginCall call) {
        final int id = call.getInt("id", -1);
        final String host = call.getString("host");
        final int port = call.getInt("port", -1);
        final String data = call.getString("data");
        Entry e = open(id, false);
        if (e == null) {
            call.reject("socket is closed");
            return;
        }
        if (host == null || !HOST.matcher(host).matches() || !validPort(port, false)) {
            call.reject("bad address");
            return;
        }
        if (data == null) {
            call.reject("bad data");
            return;
        }
        runOn(e, call, () -> {
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
            InetAddress to = InetAddress.getByName(host);
            e.udpSocket.send(new DatagramPacket(bytes, bytes.length, to, port));
        });
    }

    /** Run a network step on the socket's ops thread and settle the call from there. */
    private void runOn(Entry e, PluginCall call, IoStep step) {
        try {
            e.ops.execute(() -> {
                try {
                    step.run();
                    call.resolve();
                } catch (IllegalArgumentException ex) {
                    call.reject("bad data");
                } catch (Exception ex) {
                    call.reject(messageOf(ex));
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException ex) {
            call.reject("socket is closed");
        }
    }

    private interface IoStep {
        void run() throws Exception;
    }

    @PluginMethod
    public void close(PluginCall call) {
        Entry e = sockets.get(call.getInt("id", -1));
        if (e != null) finish(e, false, null);
        call.resolve();
    }

    @PluginMethod
    public void closePlugin(PluginCall call) {
        final String pluginId = call.getString("pluginId");
        if (pluginId != null) {
            for (Entry e : new ArrayList<>(sockets.values()))
                if (e.pluginId.equals(pluginId)) finish(e, false, null);
        }
        call.resolve();
    }

    private static String messageOf(Exception ex) {
        String m = ex.getMessage();
        return m != null ? m : ex.getClass().getSimpleName();
    }
}
