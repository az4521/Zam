export async function mapWithConcurrency<T>(
    values: readonly T[],
    concurrency: number,
    task: (value: T) => Promise<void>,
): Promise<void> {
    let nextIndex = 0;
    const workers = Array.from(
        { length: Math.min(Math.max(1, concurrency), values.length) },
        async () => {
            while (true) {
                const index = nextIndex++;
                if (index >= values.length) return;
                await task(values[index]);
            }
        },
    );
    await Promise.all(workers);
}
