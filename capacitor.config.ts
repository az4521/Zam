import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "moe.crafty.matrix",
    appName: "Zam",
    webDir: "build",
    android: {
        buildOptions: {
            keystorePath: undefined,
        },
    },
    ios: {
        // The web layer only pads for the bottom safe area in a few places,
        // so let the scroll view keep content out of the notch and home bar.
        contentInset: "always",
        // The inset strips before the page sets its theme-color (the default
        // dark theme's); ZamViewController follows theme-color after that.
        backgroundColor: "#313338",
    },
    plugins: {
        PushNotifications: {
            presentationOptions: ["badge", "sound", "alert"],
        },
    },
};

export default config;
