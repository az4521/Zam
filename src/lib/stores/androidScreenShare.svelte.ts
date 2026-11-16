// Android screen share state the call UI reads. `native` is fixed for the
// session (an Android Capacitor build); `available` is the ScreenShare
// plugin's answer, null until it has been asked. Buttons read it through a
// $derived, so they appear once the answer arrives.
import { Capacitor } from "@capacitor/core";

export const androidShare = $state<{
    native: boolean;
    available: boolean | null;
}>({
    native:
        typeof window !== "undefined" &&
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === "android",
    available: null,
});
