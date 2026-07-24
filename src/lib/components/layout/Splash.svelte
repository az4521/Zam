<script lang="ts">
    // Shown while a stored session is being silently restored, on the same
    // tertiary background as the login card so the restore reads as one
    // continuous surface — no login-card flash before the shell appears.
</script>

<div
    class="flex items-center justify-center bg-discord-backgroundTertiary p-4"
    style="min-height: 100dvh;"
>
    <div class="flex items-center gap-3 text-discord-textMuted">
        <div
            class="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
        ></div>
        <span>Restoring session…</span>
    </div>
</div>
