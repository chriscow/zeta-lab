import { ZetaVisualization } from './visualization.js';
import { ZetaMath } from './math.js';

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing app...');
    
    try {
        // Initialize visualization
        const container = document.getElementById('visualization');
        if (!container) {
            throw new Error('Visualization container not found');
        }
        
        const visualization = new ZetaVisualization(container);

        // Get UI elements with error checking
        const elements = {
            indexInput: document.getElementById('index'),
            indexSlider: document.getElementById('index-slider'),
            realInput: document.getElementById('real'),
            realSlider: document.getElementById('real-slider'),
            formulaSelect: document.getElementById('formula'),
            showGridCheckbox: document.getElementById('show-grid'),
            imagValueDisplay: document.getElementById('imag-value'),
            zetaValueDisplay: document.getElementById('zeta-value'),
            animSlider: document.getElementById('anim-slider'),
            originalPointsDisplay: document.getElementById('original-points'),
            downsampledPointsDisplay: document.getElementById('downsampled-points'),
            frameTimeDisplay: document.getElementById('frame-time'),
            genTimeDisplay: document.getElementById('gen-time'),
            downsamplingToggle: document.getElementById('downsampling-toggle'),
            aggressivenessSlider: document.getElementById('aggressiveness-slider'),
            worldThresholdSlider: document.getElementById('world-threshold'),
            screenThresholdSlider: document.getElementById('screen-threshold'),
            lineWidthSlider: document.getElementById('line-width')
        };

        // Verify all elements exist
        for (const [key, element] of Object.entries(elements)) {
            if (!element) {
                throw new Error(`Required element not found: ${key}`);
            }
        }

        // Animation state
        let lastFrameTime = 0;
        let animationFrameId = null;
        const ANIMATION_SPEED = 0.04;

        // Update function
        async function updateVisualization(timestamp) {
            const index = parseFloat(elements.indexInput.value);
            const real = parseFloat(elements.realInput.value);
            const formula = parseInt(elements.formulaSelect.value);
            
            if (isNaN(index) || isNaN(real)) {
                console.error('Invalid input values:', { index, real });
                return;
            }

            // Handle animation
            const animValue = parseFloat(elements.animSlider.value);
            if (animValue !== 0 && lastFrameTime !== 0) {
                const deltaTime = (timestamp - lastFrameTime) / 1000;
                const speedFactor = Math.pow(Math.abs(animValue), 3);
                const direction = Math.sign(animValue);
                const baseSpeed = 1/index;
                const indexValue = Math.abs(index);
                const logScale = Math.log10(1 + indexValue);
                const indexScale = 1 / (1 + logScale * logScale * 2);
                
                const newIndex = index + ANIMATION_SPEED * direction * speedFactor * baseSpeed * deltaTime * 100 * indexScale;
                const clampedIndex = Math.max(2, Math.min(newIndex, parseFloat(elements.indexSlider.max)));
                
                elements.indexInput.value = clampedIndex.toString();
                elements.indexSlider.value = clampedIndex.toString();

                if (newIndex < 2 || newIndex > parseFloat(elements.indexSlider.max)) {
                    stopAnimation();
                }
            }
            lastFrameTime = timestamp;

            // Update info displays
            const imag = ZetaMath.indexToImag(index, true);
            elements.imagValueDisplay.textContent = imag.toFixed(6);

            const startTime = performance.now();
            await visualization.updateSpiral(real, index, formula, true);
            const endTime = performance.now();

            elements.frameTimeDisplay.textContent = (endTime - startTime).toFixed(2);
            
            if (animValue !== 0) {
                animationFrameId = requestAnimationFrame(updateVisualization);
            }
        }

        function startAnimation() {
            if (!animationFrameId) {
                lastFrameTime = performance.now();
                animationFrameId = requestAnimationFrame(updateVisualization);
            }
        }

        function stopAnimation() {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            lastFrameTime = 0;
            elements.animSlider.value = "0";
        }

        // Setup input synchronization
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
        syncInputs(elements.indexInput, elements.indexSlider);
        syncInputs(elements.realInput, elements.realSlider);
        elements.formulaSelect.addEventListener('change', () => updateVisualization(performance.now()));

        // Animation controls
        elements.animSlider.addEventListener('input', () => {
            const value = parseFloat(elements.animSlider.value);
            if (value === 0) {
                stopAnimation();
            } else {
                startAnimation();
            }
        });

        elements.animSlider.addEventListener('mouseup', stopAnimation);
        elements.animSlider.addEventListener('touchend', stopAnimation);
        elements.animSlider.addEventListener('mouseleave', stopAnimation);

        // Grid visibility
        elements.showGridCheckbox.addEventListener('change', () => {
            visualization.setGridVisible(elements.showGridCheckbox.checked);
        });

        // Performance metrics update
        visualization.onZetaUpdate = (data) => {
            elements.zetaValueDisplay.textContent = data.zeta.toString();
            elements.originalPointsDisplay.textContent = data.performance.pointCount.toString();
            elements.downsampledPointsDisplay.textContent = data.performance.downsampledCount.toString();
            elements.genTimeDisplay.textContent = data.performance.totalTime.toFixed(2);
        };

        // Optimization controls
        elements.downsamplingToggle.addEventListener('change', (e) => {
            visualization.setDownsampling(e.target.checked);
            updateVisualization(performance.now());
        });

        elements.aggressivenessSlider.addEventListener('input', (e) => {
            visualization.setDownsamplingAggressiveness(parseFloat(e.target.value));
            updateVisualization(performance.now());
        });

        elements.worldThresholdSlider.addEventListener('input', (e) => {
            visualization.worldDistanceThreshold = parseFloat(e.target.value);
            updateVisualization(performance.now());
        });

        elements.screenThresholdSlider.addEventListener('input', (e) => {
            visualization.screenDistanceThreshold = parseFloat(e.target.value);
            updateVisualization(performance.now());
        });

        elements.lineWidthSlider.addEventListener('input', (e) => {
            visualization.lineWidth = parseFloat(e.target.value);
            updateVisualization(performance.now());
        });

        // Initial update
        updateVisualization(performance.now());
        
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        // Display error to user
        const container = document.getElementById('visualization');
        if (container) {
            container.innerHTML = `<div class="error">Failed to initialize: ${error.message}</div>`;
        }
    }
}); 