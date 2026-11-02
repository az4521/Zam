/** A QR sign-in step failed or was cancelled; `message` is user-facing. */
export class QrLoginError extends Error {
    constructor(
        message: string,
        readonly kind: "cancelled" | "failed" = "failed",
    ) {
        super(message);
        this.name = "QrLoginError";
    }
}
