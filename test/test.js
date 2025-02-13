const { Complex, ZetaMath } = require('../js/math.js');

function assertClose(actual, expected, tolerance = 1e-10, message = '') {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
        throw new Error(`${message} Expected ${expected} but got ${actual}, diff: ${diff}`);
    }
}

function assertComplexClose(actual, expected, tolerance = 1e-10, message = '') {
    assertClose(actual.real, expected.real, tolerance, `${message} (real part)`);
    assertClose(actual.imag, expected.imag, tolerance, `${message} (imaginary part)`);
}

// Test cases
function runTests() {
    console.log('Running tests...');
    
    // Test indexToImag
    console.log('\nTesting indexToImag...');
    const testIndices = [1, 2, 3, 5.24];
    for (const index of testIndices) {
        const jsResult = ZetaMath.indexToImag(index, true);
        console.log(`Index ${index}: ${jsResult}`);
    }

    // Test Riemann-Siegel formula
    console.log('\nTesting Riemann-Siegel formula...');
    const testCases = [
        { real: 0.5, index: 1 },
        { real: 0.5, index: 2 },
        { real: 0.5, index: 3 }
    ];

    for (const test of testCases) {
        const imag = ZetaMath.indexToImag(test.index, true);
        const result = ZetaMath.reimannSiegel(new Complex(test.real, imag));
        console.log(`s = ${test.real} + ${imag}i: ζ(s) = ${result.toString()}`);
    }

    console.log('\nAll tests completed!');
}

// Run tests
try {
    runTests();
} catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
} 