// Session-wide message-search state. `unsupported` flips to true the first
// time the homeserver answers /search with M_UNRECOGNIZED — the UI hides the
// search entry points for the rest of the session instead of erroring.
export const searchState = $state({
    unsupported: false,
});
