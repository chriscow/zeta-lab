// This worker computes the incremental delta vectors for the given chunk.
// Each message from the main thread should include { chunk, real, imag }.
onmessage = function (e) {
    const { chunk, real, imag } = e.data;
    console.log('Worker received chunk:', chunk);
    const prefix = [];
    let running = { x: 0, y: 0 };
    for (const i of chunk) {
        const angle = imag * Math.log(i);
        const dx = Math.cos(angle) / Math.pow(i, real);
        const dy = -Math.sin(angle) / Math.pow(i, real);
        running.x += dx;
        running.y += dy;
        prefix.push({ x: running.x, y: running.y });
    }
    // Return the chunk's prefix and its total vector sum (for offset adjustment)
    postMessage({
        prefix,
        localSum: running
    });
}; 