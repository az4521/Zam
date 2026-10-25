import { describe, it, expect } from "vitest";
import { createRequire } from "module";
import vm from "vm";

const require = createRequire(import.meta.url);
const { buildProxyConfig, sanitizePrefs, wrapPac, flagProxy } =
    require("../../../electron/proxy.cjs") as {
        buildProxyConfig: (
            prefs: ReturnType<typeof sanitizePrefs>,
            extra: string[],
            commandLine: CommandLine,
            loadPac: (url: string) => Promise<string>,
        ) => Promise<Record<string, string> | null>;
        sanitizePrefs: (raw: unknown) => {
            mode: string;
            rules: string;
            bypass: string;
            pacUrl: string;
            calls: string;
        };
        wrapPac: (original: string, direct: string[]) => string;
        flagProxy: (cl: CommandLine) => Record<string, string> | null;
    };

interface CommandLine {
    getSwitchValue(name: string): string;
    hasSwitch(name: string): boolean;
}

function commandLine(switches: Record<string, string> = {}): CommandLine {
    return {
        getSwitchValue: (n) => switches[n] ?? "",
        hasSwitch: (n) => n in switches,
    };
}

const noPac = async () => {
    throw new Error("PAC not expected");
};

describe("sanitizePrefs", () => {
    it("falls back to defaults for junk", () => {
        expect(sanitizePrefs({ mode: "evil", calls: 3, rules: 5 })).toEqual({
            mode: "system",
            rules: "",
            bypass: "",
            pacUrl: "",
            calls: "default",
        });
    });

    it("strips newlines and trims", () => {
        expect(
            sanitizePrefs({ mode: "manual", rules: " socks5://h:1\n" }).rules,
        ).toBe("socks5://h:1");
    });
});

describe("buildProxyConfig", () => {
    const manual = sanitizePrefs({
        mode: "manual",
        rules: "socks5://127.0.0.1:9050",
        bypass: "example.org, 10.0.0.0/8",
    });

    it("turns manual prefs into fixed servers with the user's bypass list", async () => {
        expect(
            await buildProxyConfig(manual, [], commandLine(), noPac),
        ).toEqual({
            mode: "fixed_servers",
            proxyRules: "socks5://127.0.0.1:9050",
            proxyBypassRules: "example.org,10.0.0.0/8",
        });
    });

    it("adds call server addresses, IPv6 as a /128", async () => {
        const c = await buildProxyConfig(
            manual,
            ["sfu.example", "203.0.113.5", "2001:db8::1"],
            commandLine(),
            noPac,
        );
        expect(c?.proxyBypassRules).toBe(
            "example.org,10.0.0.0/8,sfu.example,203.0.113.5,2001:db8::1/128",
        );
    });

    it("leaves Chromium alone in system mode without flags", async () => {
        expect(
            await buildProxyConfig(
                sanitizePrefs({ mode: "system" }),
                ["203.0.113.5"],
                commandLine(),
                noPac,
            ),
        ).toBeNull();
    });

    it("rebuilds the launch flags' proxy so calls can bypass it", async () => {
        const cl = commandLine({
            "proxy-server": "socks5://127.0.0.1:9050",
            "proxy-bypass-list": "lan.example",
        });
        expect(flagProxy(cl)).toMatchObject({ mode: "manual" });
        expect(
            await buildProxyConfig(
                sanitizePrefs({ mode: "system" }),
                ["203.0.113.5"],
                cl,
                noPac,
            ),
        ).toEqual({
            mode: "fixed_servers",
            proxyRules: "socks5://127.0.0.1:9050",
            proxyBypassRules: "lan.example,203.0.113.5",
        });
    });

    it("passes a PAC URL through, and wraps it once there is something to bypass", async () => {
        const pac = sanitizePrefs({ mode: "pac", pacUrl: "file:///p.pac" });
        expect(await buildProxyConfig(pac, [], commandLine(), noPac)).toEqual({
            mode: "pac_script",
            pacScript: "file:///p.pac",
        });
        const wrapped = await buildProxyConfig(
            pac,
            ["203.0.113.5"],
            commandLine(),
            async () =>
                'function FindProxyForURL(u, h) { return "SOCKS5 t:1"; }',
        );
        expect(wrapped?.pacScript).toMatch(
            /^data:application\/x-ns-proxy-autoconfig;base64,/,
        );
    });

    it("treats an empty manual or PAC setting as no proxy", async () => {
        expect(
            await buildProxyConfig(
                sanitizePrefs({ mode: "manual" }),
                [],
                commandLine(),
                noPac,
            ),
        ).toEqual({ mode: "direct" });
    });
});

describe("wrapPac", () => {
    function run(script: string, url: string, host: string): string {
        const ctx = vm.createContext({});
        vm.runInContext(script, ctx);
        return vm.runInContext(
            `FindProxyForURL(${JSON.stringify(url)}, ${JSON.stringify(host)})`,
            ctx,
        ) as string;
    }
    const original = `
        function helper() { return "SOCKS5 127.0.0.1:9050"; }
        function FindProxyForURL(url, host) { return helper(); }
    `;

    it("sends listed hosts direct and the rest to the original PAC", () => {
        const s = wrapPac(original, ["203.0.113.5", "2001:db8::1"]);
        expect(run(s, "https://203.0.113.5:7881/", "203.0.113.5")).toBe(
            "DIRECT",
        );
        expect(run(s, "https://[2001:db8::1]:7881/", "[2001:db8::1]")).toBe(
            "DIRECT",
        );
        expect(run(s, "https://example.org/", "example.org")).toBe(
            "SOCKS5 127.0.0.1:9050",
        );
    });
});
