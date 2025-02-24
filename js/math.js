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
        // Cap the index at 2000
        index = Math.min(index, 2000);
        console.log(`DEBUG: Index after capping: ${index}`);

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
     * Single-threaded implementation with optimized memory usage.
     * The formula consists of three main parts:
     * 1. Main sum up to v = floor(sqrt(t/2π))
     * 2. Correction term using the R function
     * 3. Final multiplication by e^(-iV(t))
     * 
     * @param {Complex} s - The input point s = σ + it
     * @returns {Complex} The calculated value of ζ(s)
     */
    static reimannSiegel(s) {
        console.time('reimannSiegel');
        const t = s.imag;
        console.log(`[DEBUG] Computing Riemann-Siegel with t = ${t}`);
        
        
        // Calculate the number of terms needed
        const v = Math.floor(Math.sqrt(t / (2 * Math.PI)));
        console.log(`[DEBUG] Computing Riemann-Siegel with ${v} terms`);
        
        // Pre-allocate arrays for better memory usage
        let sum = 0;
        
        // Main sum calculation
        console.time('mainSum');
        for (let k = 0; k < v; k++) {
            const term = Math.cos(this.V(t) - t * Math.log(k + 1)) / Math.sqrt(k + 1);
            sum += term;
        }
        console.timeEnd('mainSum');
        
        sum *= 2; // Double the sum as per formula
        
        // Calculate the correction term
        console.time('correctionTerm');
        const T = Math.sqrt(t / (2 * Math.PI)) - v;
        const phi = Math.cos(2 * Math.PI * (T * T - T - 1.0 / 16.0)) / Math.cos(2 * Math.PI * T);
        const c0 = phi;
        const b = Math.pow(-1, v - 1) * Math.pow(2 * Math.PI / t, 0.25) * c0;
        const Z = sum + b;
        console.timeEnd('correctionTerm');
        
        // Apply the phase factor
        console.time('phaseFactor');
        const angle = -this.V(t);
        const result = new Complex(
            Z * Math.cos(angle),
            Z * Math.sin(angle)
        );
        console.timeEnd('phaseFactor');
        
        console.timeEnd('reimannSiegel');
        return result;
    }

    /**
     * calculateSpiral generates points for visualizing the Riemann Zeta function.
     * Single-threaded implementation with memory optimization and downsampling.
     * 
     * @param {number} real - Real part of the input
     * @param {number} index - Index for imaginary part calculation
     * @param {number} formula - Formula selection (0 for RS, 1 for EM)
     * @param {boolean} useNewImag - Whether to use new imaginary formula
     * @param {Object} options - Configuration options
     * @returns {Object} Generated points and zeta value
     */
    static calculateSpiral(real, index, formula, useNewImag = true, options = {}) {
        console.time('calculateSpiral');
        const {
            downsamplingEnabled = false,
            downsamplingAggressiveness = 1.0,
            worldDistanceThreshold = 0.1,
            screenDistanceThreshold = 1.0,
            screenCheckInterval = 2,
            forceIncludeCount = 1000
        } = options;

        // Cap the index at 2000
        index = Math.min(index, 2000);
        console.log(`[DEBUG] Index capped at: ${index}`);

        // Calculate imaginary part
        const imag = this.indexToImag(index, useNewImag);
        console.log(`[DEBUG] Calculating spiral for s = ${real} + ${imag}i (index: ${index})`);

        // Calculate the number of terms needed
        var middleIndex = Math.floor((2 * index * (index + 1)) / (2 * 0 + 1) + 1 / (3 * (2 * 0 + 1)) - 1);
        var spiralLength = middleIndex + 2;
        console.log(`[DEBUG] Calculating spiral for ${spiralLength} terms (capped index: ${index})`);

        // Pre-allocate arrays for better memory usage
        const points = new Array(forceIncludeCount);
        let runningSum = { x: 0, y: 0 };
        let pointCount = 0;

        // Force include first N points
        console.time('forceIncludePoints');
        for (let i = 1; i <= Math.min(17000, Math.min(forceIncludeCount, spiralLength)); i++) {
            const angle = imag * Math.log(i);
            const magnitude = 1 / Math.pow(i, real);
            const dx = Math.cos(angle) * magnitude;
            const dy = -Math.sin(angle) * magnitude;
            runningSum.x += dx;
            runningSum.y += dy;
            points[pointCount++] = { x: runningSum.x, y: runningSum.y };
        }
        console.timeEnd('forceIncludePoints');

        // Calculate remaining points with downsampling
        console.time('remainingPoints');
        let lastIncluded = points[pointCount - 1];
        let lastScreenPos = null;

        for (let i = forceIncludeCount + 1; i < spiralLength; i++) {
            const angle = imag * Math.log(i);
            const magnitude = 1 / Math.pow(i, real);
            const dx = Math.cos(angle) * magnitude;
            const dy = -Math.sin(angle) * magnitude;
            runningSum.x += dx;
            runningSum.y += dy;
            
            const current = { x: runningSum.x, y: runningSum.y };
            
            if (!downsamplingEnabled) {
                points[pointCount++] = current;
                continue;
            }

            // World-space check first (cheaper)
            const worldDist = Math.hypot(current.x - lastIncluded.x, current.y - lastIncluded.y);
            if (worldDist > worldDistanceThreshold * (1 + downsamplingAggressiveness)) {
                points[pointCount++] = current;
                lastIncluded = current;
                continue;
            }

            // Screen-space check (more expensive, do less frequently)
            if (i % screenCheckInterval === 0) {
                const currentScreen = { x: current.x * 100, y: current.y * 100 }; // Simple screen projection
                if (lastScreenPos) {
                    const screenDist = Math.hypot(
                        currentScreen.x - lastScreenPos.x,
                        currentScreen.y - lastScreenPos.y
                    );
                    if (screenDist > screenDistanceThreshold * (1 + downsamplingAggressiveness)) {
                        points[pointCount++] = current;
                        lastIncluded = current;
                        lastScreenPos = currentScreen;
                    }
                } else {
                    lastScreenPos = currentScreen;
                }
            }
        }
        console.timeEnd('remainingPoints');

        // Trim array to actual size
        const finalPoints = points.slice(0, pointCount);
        
        // Calculate zeta value
        const s = new Complex(real, imag);
        const zeta = formula === 0 ? this.reimannSiegel(s) : this.eulerMaclaurin(s);

        console.timeEnd('calculateSpiral');
        console.log(`[DEBUG] Generated ${pointCount} points (${spiralLength - pointCount} removed by downsampling)`);

        return {
            points: finalPoints,
            zeta
        };
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Complex, ZetaMath };
} 