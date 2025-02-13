// Import the modules (adjust paths as necessary)
import { Complex, ZetaMath } from '../js/math.js';
import assert from 'assert';

async function testCalculateSpiral() {
    console.log('DEBUG: Testing calculateSpiral (sequential) ...');
    // Use small values for a quick test
    const real = 0.5;
    const index = 1;
    const formula = 0;
    const result = await ZetaMath.calculateSpiral(real, index, formula);
    
    // Debug output
    console.log('DEBUG: Sequential spiral test result:', result);
    
    // Verify structure and basic properties
    assert(Array.isArray(result.points), 'got array of points');
    assert(typeof result.scale === 'object', 'got scale object');
    assert(result.zeta instanceof Complex, 'zeta is instance of Complex');
    assert(result.points.length >= 1, 'at least one point is computed');
    console.log('DEBUG: Passed calculateSpiral test.');
}

async function testCalculateSpiralParallel() {
    console.log('DEBUG: Testing calculateSpiralParallel (parallel) ...');
    const real = 0.5;
    const index = 1;
    const formula = 0;
    const resultParallel = await ZetaMath.calculateSpiralParallel(real, index, formula);
    
    // Debug output
    console.log('DEBUG: Parallel spiral test result:', resultParallel);
    
    // Verify structure and basic properties
    assert(Array.isArray(resultParallel.points), 'got array of points');
    assert(typeof resultParallel.scale === 'object', 'got scale object');
    assert(resultParallel.zeta instanceof Complex, 'zeta is instance of Complex');
    assert(resultParallel.points.length >= 1, 'at least one point is computed');
    console.log('DEBUG: Passed calculateSpiralParallel test.');
}

// Run tests

(async function runTests() {
    try {
        await testCalculateSpiral();
        await testCalculateSpiralParallel();
        console.log('All tests passed.');
    } catch (error) {
        console.error('Test failed:', error);
    }
})(); 