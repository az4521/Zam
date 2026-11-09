// Zam's E2EE worker: LiveKit's, with the redundancy hook in front. The hook
// import must stay first so its listener is registered before LiveKit's.
import "./hook";
import "livekit-client/e2ee-worker";
