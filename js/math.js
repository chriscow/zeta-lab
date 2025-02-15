// Package math provides core mathematical functionality for visualizing the Riemann Zeta function.
// It implements complex number operations and various algorithms for calculating
// the Riemann Zeta function using different methods.

/**
 * Complex represents a complex number with real and imaginary parts.
 * It provides basic arithmetic operations and utilities for complex number manipulation.
 */
export class Complex {
    /**
     * Creates a new Complex number.
     * @param {number} real - The real part of the complex number
     * @param {number} imag - The imaginary part of the complex number
     */
    constructor(real = 0, imag = 0) {
        this.real = real;
        this.imag = imag;
    }

    /**
     * add returns the sum of two complex numbers.
     * @param {Complex} a - First complex number
     * @param {Complex} b - Second complex number
     * @returns {Complex} The sum a + b
     */
    static add(a, b) {
        return new Complex(a.real + b.real, a.imag + b.imag);
    }

    /**
     * multiply returns the product of two complex numbers.
     * Uses the formula (a + bi)(c + di) = (ac - bd) + (ad + bc)i
     * @param {Complex} a - First complex number
     * @param {Complex} b - Second complex number
     * @returns {Complex} The product a * b
     */
    static multiply(a, b) {
        return new Complex(
            a.real * b.real - a.imag * b.imag,
            a.real * b.imag + a.imag * b.real
        );
    }

    /**
     * pow computes complex exponentiation a^b.
     * For complex exponents, uses the formula e^(ln(z)*w).
     * For real exponents, uses polar form.
     * @param {Complex} base - The base complex number
     * @param {Complex|number} exp - The exponent (complex or real)
     * @returns {Complex} The result of base^exp
     */
    static pow(base, exp) {
        if (exp instanceof Complex) {
            // Complex exponentiation using e^(ln(z)*w)
            const r = Math.sqrt(base.real * base.real + base.imag * base.imag);
            const theta = Math.atan2(base.imag, base.real);
            const ln_r = Math.log(r);
            const new_r = Math.exp(ln_r * exp.real - theta * exp.imag);
            const new_theta = theta * exp.real + ln_r * exp.imag;
            return new Complex(
                new_r * Math.cos(new_theta),
                new_r * Math.sin(new_theta)
            );
        } else {
            // Real exponentiation using polar form
            const r = Math.sqrt(base.real * base.real + base.imag * base.imag);
            const theta = Math.atan2(base.imag, base.real);
            const new_r = Math.pow(r, exp);
            const new_theta = theta * exp;
            return new Complex(
                new_r * Math.cos(new_theta),
                new_r * Math.sin(new_theta)
            );
        }
    }

    /**
     * exp computes e^z for a complex number z.
     * Uses the formula e^(a + bi) = e^a(cos(b) + i*sin(b))
     * @param {Complex} z - The complex exponent
     * @returns {Complex} e raised to the complex power z
     */
    static exp(z) {
        const e = Math.exp(z.real);
        return new Complex(
            e * Math.cos(z.imag),
            e * Math.sin(z.imag)
        );
    }

    /**
     * abs returns the absolute value (magnitude) of the complex number.
     * @returns {number} The magnitude √(real² + imag²)
     */
    abs() {
        return Math.sqrt(this.real * this.real + this.imag * this.imag);
    }

    /**
     * toString returns a string representation of the complex number.
     * @returns {string} The complex number in the form "a + bi"
     */
    toString() {
        return `${this.real.toFixed(6)} + ${this.imag.toFixed(6)}i`;
    }
}

/**
 * ZetaMath provides methods for calculating and visualizing the Riemann Zeta function.
 * It implements various algorithms including the Riemann-Siegel formula and spiral visualization.
 */
export class ZetaMath {
    // Constants used in calculations
    static TWO_PI = Math.PI * 2;
    static SQRT_TWO_PI = Math.sqrt(ZetaMath.TWO_PI);

    /**
     * indexToImag converts an index to the imaginary part of the input for the Zeta function.
     * Two formulas are available:
     * 1. New formula: 2π(t² + t + 1/6)
     * 2. Old formula: (π(2n + 1))/(log(n + 1) - log(n))
     * 
     * @param {number} index - The input index
     * @param {boolean} useNew - Whether to use the new formula (default: true)
     * @returns {number} The calculated imaginary part
     */
    static indexToImag(index, useNew = true) {
        if (useNew) {
            // new formula: 2pi*(t^2+t+1/6)
            return 2.0 * Math.PI * ((index * index) + index + (1.0 / 6.0));
        } else {
            // old formula: (π (2 n + 1))/( log(n + 1) - log(n))
            return (index * 2.0 + 1.0) * Math.PI / (Math.log(index + 1.0) - Math.log(index));
        }
    }

    /**
     * V calculates the phase factor V(t) used in the Riemann-Siegel formula.
     * This is a critical component that affects both the calculation of Z(t)
     * and the final multiplication by e^(-iV(t)).
     * 
     * @param {number} t - The imaginary part of the input
     * @returns {number} The calculated phase factor
     */
    static V(t) {
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

    /**
     * reimannSiegel implements the Riemann-Siegel formula for calculating ζ(s).
     * This is a parallel implementation that distributes the calculation across multiple Web Workers.
     * The formula consists of three main parts:
     * 1. Main sum up to v = floor(sqrt(t/2π))
     * 2. Correction term using the R function
     * 3. Final multiplication by e^(-iV(t))
     * 
     * @param {Complex} s - The input point s = σ + it
     * @returns {Promise<Complex>} The calculated value of ζ(s)
     */
    static async reimannSiegel(s) {
        const t = s.imag;
        // Calculate the number of terms needed
        const v = Math.floor(Math.sqrt(t / (2 * Math.PI)));
        
        // Initialize parallel processing
        const NUM_WORKERS = Math.max(navigator.hardwareConcurrency || 4, 8);
        const chunkSize = Math.ceil(v / NUM_WORKERS);
        const workers = [];
        const promises = [];
        const results = new Array(NUM_WORKERS);
        
        console.log(`Parallelizing Riemann-Siegel calculation with ${NUM_WORKERS} workers`);
        console.log(`Total terms: ${v}, chunk size: ${chunkSize}`);
        
        // Distribute work across workers
        for (let i = 0; i < NUM_WORKERS; i++) {
            const startK = i * chunkSize;
            const endK = Math.min((i + 1) * chunkSize, v);
            
            const worker = new Worker('js/riemann-worker.js');
            workers.push(worker);
            
            promises.push(new Promise(resolve => {
                worker.onmessage = e => {
                    results[e.data.chunkId] = e.data;
                    resolve(e.data);
                };
            }));
            
            worker.postMessage({ 
                startK, 
                endK, 
                t,
                chunkId: i 
            });
        }
        
        // Wait for all calculations to complete
        await Promise.all(promises);
        
        // Cleanup workers
        workers.forEach(w => w.terminate());
        
        // Combine results in order to maintain accuracy
        let sum = 0;
        const allTerms = [];
        
        for (const result of results) {
            if (result) {
                allTerms.push(...result.terms);
                sum += result.partialSum;
            }
        }
        
        sum *= 2; // Double the sum as per formula
        
        console.log(`Parallel calculation complete. Total terms: ${allTerms.length}`);
        
        // Calculate the correction term
        const T = Math.sqrt(t / (2 * Math.PI)) - v;
        const phi = Math.cos(2 * Math.PI * (T * T - T - 1.0 / 16.0)) / Math.cos(2 * Math.PI * T);
        const c0 = phi;
        const b = Math.pow(-1, v - 1) * Math.pow(2 * Math.PI / t, 0.25) * c0;
        const Z = sum + b;
        
        // Apply the phase factor
        const angle = -this.V(t);
        return new Complex(
            Z * Math.cos(angle),
            Z * Math.sin(angle)
        );
    }

    /**
     * calculateSpiral generates points for visualizing the Riemann Zeta function.
     * The spiral is constructed by calculating vectors from each point to the next,
     * following the path of integration used in the Riemann-Siegel formula.
     * 
     * @param {number} real - The real part of the input (σ)
     * @param {number} index - The index used to calculate the imaginary part
     * @param {number} formula - The formula selection (currently only Riemann-Siegel is implemented)
     * @param {boolean} useNewImag - Whether to use the new formula for imaginary part calculation
     * @param {Object} stepConfig - Configuration for step size calculation
     * @param {boolean} stepConfig.useAdaptive - Whether to use adaptive step size
     * @param {number} stepConfig.factor - Factor to adjust step size (0.1 to 2.0)
     * @returns {Promise<{points: Array<{x: number, y: number, z: number}>, zeta: Complex}>}
     */
    static async calculateSpiral(real, index, formula, useNewImag = true, stepConfig = { useAdaptive: true, factor: 1.0 }) {
        const imag = this.indexToImag(index, useNewImag);
        
        // Calculate the range needed for integration
        const totalRange = Math.floor(imag / Math.PI + 1);
        
        // Use fixed step size of 1 for maximum accuracy
        const stepSize = 1;
        
        console.log(`Calculating spiral with:
            imag=${imag}
            totalRange=${totalRange}
            stepSize=${stepSize} (fixed for accuracy)`);
        
        // Initialize spiral construction
        const points = [];
        let start = { x: 0, y: 0, z: 0 };
        points.push(start);

        // Track scaling factors for visualization
        let minVal = 0, maxVal = 0;
        
        // Calculate the Zeta value at the target point
        let zeta;
        switch (formula) {
            case 0: // Reimann-Siegel
                zeta = await this.reimannSiegel(new Complex(real, imag));
                break;
            default:
                zeta = await this.reimannSiegel(new Complex(real, imag));
        }

        // Debug output for verification
        const debugPoints = 5;
        console.log('\nSpiral Construction Debug:');
        console.log('imag:', imag);
        
        // Construct the spiral point by point
        for (let i = 1; i <= totalRange; i += stepSize) {
            // Calculate polar coordinates
            const angle = imag * Math.log(i);
            const magnitude = 1 / Math.pow(i, real);
            
            // Convert to Cartesian coordinates
            const x = Math.cos(angle) * magnitude;
            const y = -Math.sin(angle) * magnitude;

            // Update scaling bounds
            minVal = Math.min(minVal, x, y);
            maxVal = Math.max(maxVal, x, y);

            // Detailed debug output for first few points
            if (points.length <= debugPoints) {
                console.log(`\nPoint ${points.length}:`);
                console.log('  i:', i);
                console.log('  angle (radians):', angle);
                console.log('  angle (degrees):', (angle * 180 / Math.PI) % 360);
                console.log('  magnitude:', magnitude);
                console.log('  vector:', { x, y });
                console.log('  position:', { x: start.x + x, y: start.y + y });
            }
            
            // Add point to spiral
            const end = {
                x: start.x + x,
                y: start.y + y,
                z: 0
            };
            points.push(end);
            start = end;
        }

        // Log final results for verification
        console.log('\nFinal Values:');
        console.log('Final point:', points[points.length - 1]);
        console.log('Zeta value:', { real: zeta.real, imag: zeta.imag });

        // Additional debug info for spiral direction
        if (points.length >= 3) {
            console.log('\nSpiral Summary:');
            console.log('First link vector:', points[1].x - points[0].x, points[1].y - points[0].y);
            console.log('First point:', points[0]);
            console.log('Second point:', points[1]);
            console.log('Scale range:', { min: minVal, max: maxVal });
            console.log('Total points:', points.length);
            console.log('Final i value:', totalRange);
            console.log('Final point:', points[points.length - 1]);
            
            // Calculate and log spiral rotation
            const firstAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
            const secondAngle = Math.atan2(points[2].y - points[1].y, points[2].x - points[1].x);
            console.log('\nSpiral Direction:');
            console.log('First segment angle (degrees):', (firstAngle * 180 / Math.PI) % 360);
            console.log('Second segment angle (degrees):', (secondAngle * 180 / Math.PI) % 360);
            console.log('Angle change:', ((secondAngle - firstAngle) * 180 / Math.PI) % 360);
        }

        return { 
            points, 
            zeta,
            scale: {
                min: minVal,
                max: maxVal
            }
        };
    }

    /**
     * calculateSpiralParallel generates points for visualizing the Riemann Zeta function
     * in parallel. It splits the independent delta calculations across multiple
     * Web Workers and then reconstructs the continuous spiral by performing a prefix sum.
     *
     * @param {number} real - The real part of the input (σ)
     * @param {number} index - The index used to calculate the imaginary part
     * @param {number} formula - The formula selection (currently only Riemann-Siegel is implemented)
     * @param {boolean} useNewImag - Whether to use the new formula for imaginary part calculation
     * @param {Object} stepConfig - Configuration for step size calculation
     * @param {boolean} stepConfig.useAdaptive - Whether to use adaptive step size
     * @param {number} stepConfig.factor - Factor to adjust step size (0.1 to 2.0)
     * @returns {Promise<{points: Array<{x: number, y: number, z: number}>, zeta: Complex, scale: {min: number, max: number}}>}
     */
    static async calculateSpiralParallel(real, index, formula, useNewImag = true, stepConfig = { useAdaptive: true, factor: 1.0 }) {
        // Compute the imaginary part as before
        const imag = this.indexToImag(index, useNewImag);
        const totalRange = Math.floor(imag / Math.PI + 1);
        
        // Use fixed step size of 1 for maximum accuracy
        const stepSize = 1;

        console.log(`Parallel Spiral calculation with:
            imag=${imag}
            totalRange=${totalRange}
            stepSize=${stepSize} (fixed for accuracy)`);

        // Build an array of iteration values based on step size
        const iterationValues = [];
        for (let i = 1; i <= totalRange; i += stepSize) {
            iterationValues.push(i);
        }
        console.log(`Parallel Spiral: total iterations = ${iterationValues.length}`);

        // Decide on number of workers (or threads)
        const numWorkers = navigator.hardwareConcurrency || 4;
        const chunkSize = Math.ceil(iterationValues.length / numWorkers);
        console.log(`Dividing iterations into ${numWorkers} chunk(s) of ~${chunkSize} values each`);

        // Dispatch chunks to workers
        const promises = [];
        for (let i = 0; i < numWorkers; i++) {
            const chunk = iterationValues.slice(i * chunkSize, (i + 1) * chunkSize);
            const worker = new Worker('js/spiralWorker.js');
            promises.push(new Promise(resolve => {
                worker.onmessage = e => {
                    console.log(`Worker for chunk ${i} done`);
                    resolve({ chunkIndex: i, chunkResult: e.data });
                    worker.terminate();
                };
                worker.postMessage({ chunk, real, imag });
            }));
        }

        // Wait for all workers to finish and sort the results by chunk index
        const results = (await Promise.all(promises)).sort((a, b) => a.chunkIndex - b.chunkIndex);

        // Reassemble the spiral by applying a prefix sum adjustment to each chunk
        let offsetX = 0;
        let offsetY = 0;
        const points = [];
        points.push({ x: 0, y: 0, z: 0 });
        let globalMin = 0;
        let globalMax = 0;

        for (const res of results) {
            const { prefix, localSum } = res.chunkResult;
            // Adjust each point in this chunk by the accumulated offset
            for (const p of prefix) {
                const x = p.x + offsetX;
                const y = p.y + offsetY;
                points.push({ x, y, z: 0 });
                globalMin = Math.min(globalMin, x, y);
                globalMax = Math.max(globalMax, x, y);
            }
            // Update offset for the next chunk
            offsetX += localSum.x;
            offsetY += localSum.y;
        }

        // Calculate the Zeta value at the target point (as in the original method)
        let zeta;
        switch (formula) {
            case 0: // Riemann-Siegel
                zeta = await this.reimannSiegel(new Complex(real, imag));
                break;
            default:
                zeta = await this.reimannSiegel(new Complex(real, imag));
        }

        console.log(`Parallel Spiral complete. Total points: ${points.length}`);
        console.log(`Scale range: { min: ${globalMin}, max: ${globalMax} }`);

        return {
            points,
            zeta,
            scale: { min: globalMin, max: globalMax }
        };
    }

    static downsampleComplex(links, outputSize, aggressiveness, debug = false) {
        if (links.length === 0) {
            console.warn('No links to downsample');
            return links;
        }

        if (debug) {
            console.log(`Starting downsampleComplex with ${links.length} points, outputSize=${outputSize}, aggressiveness=${aggressiveness}`);
        }

        // Determine view bounds from the links
        let minX = links[0].real, maxX = links[0].real;
        let minY = links[0].imag, maxY = links[0].imag;
        for (const link of links) {
            minX = Math.min(minX, link.real);
            maxX = Math.max(maxX, link.real);
            minY = Math.min(minY, link.imag);
            maxY = Math.max(maxY, link.imag);
        }

        // Calculate relative distance between points
        const maxRange = Math.max(maxX - minX, maxY - minY);
        const baseRange = Math.max(0.01, maxRange);
        const relativeSpread = maxRange / baseRange;

        // Scale the maxRelativeSpread based on aggressiveness
        let maxRelativeSpread = 0.0001; // Base threshold at 0.01%
        if (aggressiveness > 0.0) {
            maxRelativeSpread *= Math.pow(5, aggressiveness);
        }

        // Add extra smoothing for values between 3.5 and 4.0
        if (aggressiveness > 3.5) {
            const t = (aggressiveness - 3.5) / 0.5;
            maxRelativeSpread = 0.03 + (0.02 * t);
        }

        // Also consider pixel-space proximity for grouping
        let pixelSpreadThreshold = 1.0;
        if (aggressiveness > 0.0) {
            pixelSpreadThreshold += (aggressiveness * 2.0);
        }

        // If the relative spread is small enough, average all points
        if (relativeSpread <= maxRelativeSpread) {
            let sum = { real: 0, imag: 0 };
            for (const link of links) {
                sum.real += link.real;
                sum.imag += link.imag;
            }
            return [{
                real: sum.real / links.length,
                imag: sum.imag / links.length
            }];
        }

        // Helper to compute pixel coordinate for a link
        const pixelForLink = (link) => {
            const normalizedX = (link.real - minX) / (maxX - minX);
            const normalizedY = (link.imag - minY) / (maxY - minY);
            const px = Math.round(normalizedX * outputSize);
            const py = Math.round(normalizedY * outputSize);
            return { px, py };
        };

        // Calculate interpolation threshold based on aggressiveness
        let interpolationThreshold = 1.1 * Math.pow(2.5, aggressiveness);
        if (aggressiveness > 3.5) {
            const t = (aggressiveness - 3.5) / 0.5;
            interpolationThreshold = 55.0 + (20.0 * t);
        }

        const downsampled = [];
        
        // Initialize with first point
        const { px: initPx, py: initPy } = pixelForLink(links[0]);
        let currentGroup = {
            sum: { real: links[0].real, imag: links[0].imag },
            count: 1,
            pixelX: initPx,
            pixelY: initPy,
            lastLink: links[0]
        };

        // Helper to flush a group
        const flushGroup = (group) => ({
            real: group.sum.real / group.count,
            imag: group.sum.imag / group.count
        });

        // Process all points sequentially
        for (let i = 1; i < links.length; i++) {
            const link = links[i];
            const { px, py } = pixelForLink(link);

            // Check if this point belongs to current group
            if (px === currentGroup.pixelX && py === currentGroup.pixelY ||
                (Math.abs(px - currentGroup.pixelX) <= pixelSpreadThreshold &&
                 Math.abs(py - currentGroup.pixelY) <= pixelSpreadThreshold)) {
                currentGroup.sum.real += link.real;
                currentGroup.sum.imag += link.imag;
                currentGroup.count++;
                currentGroup.lastLink = link;
                continue;
            }

            // Group changed: flush current group
            const avg = flushGroup(currentGroup);
            downsampled.push(avg);

            // Check for interpolation
            const dx = px - currentGroup.pixelX;
            const dy = py - currentGroup.pixelY;
            const pixelGap = Math.sqrt(dx * dx + dy * dy);

            if (pixelGap > interpolationThreshold) {
                let steps = Math.floor(pixelGap / Math.pow(2, Math.min(aggressiveness, 3.5)));
                if (aggressiveness > 3.5) {
                    const t = (aggressiveness - 3.5) / 0.5;
                    steps = Math.floor(steps * (1.0 - (0.5 * t)));
                }

                for (let s = 1; s <= steps; s++) {
                    const t = s / (steps + 1);
                    downsampled.push({
                        real: currentGroup.lastLink.real * (1 - t) + link.real * t,
                        imag: currentGroup.lastLink.imag * (1 - t) + link.imag * t
                    });
                }
            }

            // Start new group
            currentGroup = {
                sum: { real: link.real, imag: link.imag },
                count: 1,
                pixelX: px,
                pixelY: py,
                lastLink: link
            };
        }

        // Flush final group
        const finalAvg = flushGroup(currentGroup);
        downsampled.push(finalAvg);

        if (debug) {
            console.log(`Downsampled ${links.length} points to ${downsampled.length} points`);
        }

        return downsampled;
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Complex, ZetaMath };
} 