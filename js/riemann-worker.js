// riemann-worker.js implements a Web Worker for parallel computation of
// terms in the Riemann-Siegel formula. Each worker handles a chunk of the
// main summation, calculating terms and maintaining their order for later combination.

/**
 * V calculates the phase factor V(t) used in the Riemann-Siegel formula.
 * This is a copy of the function from math.js to make the worker self-contained.
 * 
 * @param {number} t - The imaginary part of the input
 * @returns {number} The calculated phase factor
 */
function V(t) {
    const fewerTerms = false;
    // Main term of the asymptotic expansion
    let result = t / 2 * Math.log(t / (2 * Math.PI)) - t / 2 - Math.PI / 8;

    if (!fewerTerms) {
        // Additional correction terms for better accuracy
        result += 1 / (48 * t) + 
                 7 / (5760 * Math.pow(t, 3)) + 
                 31 / (80640 * Math.pow(t, 5)) + 
                 127 / (430080 * Math.pow(t, 7)) + 
                 511 / (1216512 * Math.pow(t, 9));
    }

    return result;
}

// Handle messages from the main thread
self.onmessage = function(e) {
    const { startK, endK, t, chunkId } = e.data;
    console.log(`Worker processing chunk ${chunkId}: ${startK} to ${endK}`);
    
    // Initialize accumulators
    let partialSum = 0;
    const terms = [];
    
    // Calculate each term separately and maintain order
    for (let k = startK; k < endK; k++) {
        // Calculate k-th term of the Riemann-Siegel formula
        const term = Math.cos(V(t) - t * Math.log(k + 1)) / Math.sqrt(k + 1);
        terms.push(term);
        partialSum += term;
    }
    
    // Return results to main thread
    self.postMessage({
        chunkId,     // Chunk identifier for ordering
        startK,      // Starting index
        endK,        // Ending index
        partialSum,  // Sum of all terms in this chunk
        terms        // Individual terms for verification
    });
} 