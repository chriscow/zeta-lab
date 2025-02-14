import { ZetaVisualization } from './visualization.js';
import { ZetaMath } from './math.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing app...');
    
    // Initialize visualization
    const container = document.getElementById('visualization');
    const visualization = new ZetaVisualization(container);

    // Get UI elements
    const indexInput = document.getElementById('index');
    const indexSlider = document.getElementById('index-slider');
    const realInput = document.getElementById('real');
    const realSlider = document.getElementById('real-slider');
    const formulaSelect = document.getElementById('formula');
    const showGridCheckbox = document.getElementById('show-grid');
    const imagValueDisplay = document.getElementById('imag-value');
    const zetaValueDisplay = document.getElementById('zeta-value');
    const animSlider = document.getElementById('anim-slider');

    // Animation state
    let lastFrameTime = 0;
    let animationFrameId = null;
    const ANIMATION_SPEED = 0.04; // Matches Unity's .04f factor

    // Update function
    async function updateVisualization(timestamp) {
        const index = parseFloat(indexInput.value);
        const real = parseFloat(realInput.value);
        const formula = parseInt(formulaSelect.value);
        
        // Validate inputs
        if (isNaN(index) || isNaN(real)) {
            console.error('Invalid input values');
            return;
        }

        // Handle animation with progressive speed
        const animValue = parseFloat(animSlider.value);
        if (animValue !== 0 && lastFrameTime !== 0) {
            const deltaTime = (timestamp - lastFrameTime) / 1000; // Convert to seconds
            
            // Calculate progressive speed factor based on slider position
            const speedFactor = Math.pow(Math.abs(animValue), 3);
            const direction = Math.sign(animValue);
            const baseSpeed = 1/index; // Base speed for fine control
            
            // Scale speed inversely with index value
            const indexValue = Math.abs(index);
            const logScale = Math.log10(1 + indexValue);
            const indexScale = 1 / (1 + logScale * logScale * 2); // Quadratic scaling with increased factor
            
            console.log('Animation speed scaling:', { 
                index, 
                indexValue,
                logScale,
                indexScale, 
                speedFactor, 
                baseSpeed,
                finalSpeed: ANIMATION_SPEED * direction * speedFactor * baseSpeed * indexScale
            });
            
            const newIndex = index + ANIMATION_SPEED * direction * speedFactor * baseSpeed * deltaTime * 100 * indexScale;
            
            // Update index input and slider
            const clampedIndex = Math.max(0, Math.min(newIndex, parseFloat(indexSlider.max)));
            indexInput.value = clampedIndex.toString();
            indexSlider.value = clampedIndex.toString();

            // If we've gone beyond the slider range, stop animation
            if (newIndex < 0 || newIndex > parseFloat(indexSlider.max)) {
                stopAnimation();
            }
        }
        lastFrameTime = timestamp;

        // Update info displays
        const imag = ZetaMath.indexToImag(index, true);
        imagValueDisplay.textContent = imag.toFixed(6);

        console.log('Updating visualization with:', { index, real, formula, animValue });
        await visualization.updateSpiral(real, index, formula, true);

        // Update debug output with point counts
        const debugOutput = document.getElementById('debug-output');
        if (debugOutput) {
            const pointCountsInfo = `
Points:
  Original: ${visualization.pointCounts.original.toLocaleString()}
  Downsampled: ${visualization.pointCounts.downsampled.toLocaleString()}
  Reduction: ${((1 - visualization.pointCounts.downsampled / visualization.pointCounts.original) * 100).toFixed(1)}%

`;
            debugOutput.textContent = pointCountsInfo;
        }

        // Continue animation loop
        if (animValue !== 0) {
            animationFrameId = requestAnimationFrame(updateVisualization);
        }
    }

    function startAnimation() {
        console.log('Starting animation');
        if (!animationFrameId) {
            lastFrameTime = performance.now();
            animationFrameId = requestAnimationFrame(updateVisualization);
        }
    }

    function stopAnimation() {
        console.log('Stopping animation');
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        lastFrameTime = 0;
        animSlider.value = "0"; // Reset slider to center
    }

    // Sync number inputs with sliders
    function syncInputs(input, slider) {
        input.addEventListener('input', () => {
            slider.value = input.value;
            updateVisualization(performance.now());
        });
        
        slider.addEventListener('input', () => {
            input.value = slider.value;
            updateVisualization(performance.now());
        });
    }

    // Add event listeners
    syncInputs(indexInput, indexSlider);
    syncInputs(realInput, realSlider);
    formulaSelect.addEventListener('change', () => updateVisualization(performance.now()));

    // Handle animation slider
    animSlider.addEventListener('input', () => {
        const value = parseFloat(animSlider.value);
        console.log('Animation slider value:', value);
        if (value === 0) {
            stopAnimation();
        } else {
            startAnimation();
        }
    });

    // Add mouseup and touchend events to make slider snap back to center
    animSlider.addEventListener('mouseup', stopAnimation);
    animSlider.addEventListener('touchend', stopAnimation);
    // Also handle when mouse leaves the slider while dragging
    animSlider.addEventListener('mouseleave', stopAnimation);

    // Handle grid visibility
    showGridCheckbox.addEventListener('change', () => {
        visualization.setGridVisible(showGridCheckbox.checked);
    });

    // Update zeta value display
    visualization.onZetaUpdate = (zeta) => {
        zetaValueDisplay.textContent = zeta.toString();
    };

    // Add these after visualization is initialized
    document.getElementById('parallel-calculation').addEventListener('change', (e) => {
        visualization.setParallelCalculation(e.target.checked);
    });

    document.getElementById('riemann-siegel').addEventListener('change', (e) => {
        visualization.setRiemannSiegel(e.target.checked);
    });

    // Add event listeners
    const downsamplingToggle = document.getElementById('downsampling-toggle');
    const aggressivenessSlider = document.getElementById('aggressiveness-slider');
    
    downsamplingToggle.addEventListener('change', (e) => {
        visualization.setDownsampling(e.target.checked);
        // Trigger spiral update with current values
        updateVisualization(performance.now());
    });

    aggressivenessSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        visualization.setDownsamplingAggressiveness(value);
        // Trigger spiral update with current values
        updateVisualization(performance.now());
    });

    // Initial update
    updateVisualization(performance.now());
    
    console.log('App initialized');
}); 