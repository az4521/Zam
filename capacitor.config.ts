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
    plugins: {
        PushNotifications: {
            presentationOptions: ["badge", "sound", "alert"],
        },
    },
};

export default config;
