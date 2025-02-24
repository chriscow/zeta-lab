import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ZetaMath } from './math.js';
import Stats from 'three/addons/libs/stats.module.js';

export class ZetaVisualization {
    constructor(container) {
        if (!container) {
            console.error('Container element not found');
            return;
        }

        console.log('Initializing ZetaVisualization');
        this.container = container;
        this.scene = new THREE.Scene();

        // Initialize stats
        this.stats = new Stats();
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.top = '0px';
        this.stats.dom.style.left = '0px';
        container.appendChild(this.stats.dom);

        // Initialize target position
        this.targetPosition = new THREE.Vector3(0, 0, 0);

        // Track camera zoom level
        this.currentZoom = 10;

        // Switch to orthographic camera
        const aspect = container.clientWidth / container.clientHeight;
        const frustumSize = 10;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        );
        
        // Set renderer with alpha for transparent background
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setClearColor(0x000000, 0.1);
        container.appendChild(this.renderer.domElement);

        // Optional: Disable v-sync (might cause screen tearing)
        // this.renderer.setAnimationLoop(this.render.bind(this));

        // Setup camera for perfect top-down view
        this.camera.position.set(0, 0, 10);
        this.camera.up.set(0, 1, 0); // Ensure up vector is aligned with Y axis
        this.camera.lookAt(0, 0, 0);

        // Add grid helper
        const size = 10;
        const divisions = 10;
        this.gridHelper = new THREE.GridHelper(size, divisions);
        this.gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
        this.scene.add(this.gridHelper);

        // Add axes helper
        this.axesHelper = new THREE.AxesHelper(5);
        this.scene.add(this.axesHelper);

        // Setup controls - restrict to pan and zoom only
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableRotate = false; // Disable rotation
        this.controls.enableDamping = false; // Disable damping for direct response
        this.controls.screenSpacePanning = true; // Enable proper panning in orthographic mode
        this.controls.panSpeed = 1.0; // Default pan speed
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        
        // Adjust zoom sensitivity
        this.controls.zoomSpeed = 0.5; // Slightly reduced for better control

        // Set initial control target
        this.controls.target.copy(this.targetPosition);

        // Initialize spiral geometry
        this.spiralLine = null;
        this.zetaPoint = null;
        this.targetGroup = null;  // Track target group
        this.originGroup = null;  // Track origin group

        // Callback for zeta updates
        this.onZetaUpdate = null;

        // Add calculation option flags
        this.useParallelCalculation = false;
        this.useRiemannSiegel = false;

        // Add downsampling options
        this.useDownsampling = false;
        this.downsamplingAggressiveness = 1.0;
        this.worldDistanceThreshold = 0.1;
        this.screenDistanceThreshold = 1.0;
        this.screenCheckInterval = 2;
        this.forceIncludeCount = 1000;
        this.lineWidth = 1;

        // Add step size configuration
        this.useAdaptiveStep = true;
        this.stepSizeFactor = 1.0;

        // Start animation loop using standard requestAnimationFrame
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        console.log('ZetaVisualization initialized');
    }

    setAutoRotate(enabled) {
        // Remove auto-rotate functionality
        // console.log('Auto-rotate functionality has been removed');
    }

    setGridVisible(visible) {
        this.gridHelper.visible = visible;
        this.axesHelper.visible = visible;
    }

    onWindowResize() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 10;
        
        // Update orthographic camera aspect
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    // Separate render method for better organization
    render() {
        this.stats.begin();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        this.stats.end();
    }

    // Standard animation loop
    animate() {
        requestAnimationFrame(() => this.animate());
        this.render();
    }

    // Add setters for calculation options
    setParallelCalculation(enabled) {
        // console.log('Setting parallel calculation:', enabled);
        this.useParallelCalculation = enabled;
    }

    setRiemannSiegel(enabled) {
        // console.log('Calculate Riemann-Siegel:', enabled);
        this.useRiemannSiegel = enabled;
    }

    setDownsampling(enabled) {
        // console.log('Setting downsampling:', enabled);
        this.useDownsampling = enabled;
    }

    setDownsamplingAggressiveness(value) {
        // console.log('Setting downsampling aggressiveness:', value);
        this.downsamplingAggressiveness = value;
    }

    setAdaptiveStep(enabled) {
        // console.log('Setting adaptive step:', enabled);
        this.useAdaptiveStep = enabled;
    }

    setStepSizeFactor(factor) {
        // console.log('Setting step size factor:', factor);
        this.stepSizeFactor = factor;
    }

    async updateSpiral(real, index, formula, useNewImag = true) {
        const t0 = performance.now();
        
        try {
            // Create configuration object
            const options = {
                downsamplingEnabled: this.useDownsampling,
                downsamplingAggressiveness: this.downsamplingAggressiveness,
                worldDistanceThreshold: this.worldDistanceThreshold,
                screenDistanceThreshold: this.screenDistanceThreshold,
                screenCheckInterval: this.screenCheckInterval,
                forceIncludeCount: this.forceIncludeCount
            };

            // Calculate spiral points
            const { points, zeta } = ZetaMath.calculateSpiral(real, index, formula, useNewImag, options);

            const t1 = performance.now();
            console.log(`[PERF] Spiral calculation: ${(t1 - t0).toFixed(2)}ms, Points: ${points.length}`);

            // Update performance metrics
            if (this.onZetaUpdate) {
                this.onZetaUpdate({
                    zeta,
                    performance: {
                        totalTime: t1 - t0,
                        pointCount: points.length,
                        downsampledCount: points.length
                    }
                });
            }

            // Update visualization geometry
            this.updateVisualizationGeometry(points);
            
            const t2 = performance.now();
            console.log(`[PERF] Geometry update: ${(t2 - t1).toFixed(2)}ms`);
            console.log(`[PERF] Total time: ${(t2 - t0).toFixed(2)}ms`);

        } catch (error) {
            console.error('Error updating spiral:', error);
            console.error('Stack:', error.stack);
        }
    }

    updateVisualizationGeometry(points) {
        if (!points || points.length === 0) {
            console.error('No points provided for visualization');
            return;
        }

        console.time('updateVisualizationGeometry');
        console.log(`Creating geometry with ${points.length} points`);
        
        // Remove existing line if it exists
        if (this.spiralLine) {
            this.scene.remove(this.spiralLine);
            this.spiralLine.geometry.dispose();
            this.spiralLine.material.dispose();
        }

        // Create optimized geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(points.length * 3);
        
        // Fill positions directly
        for (let i = 0; i < points.length; i++) {
            positions[i * 3] = points[i].x;
            positions[i * 3 + 1] = points[i].y;
            positions[i * 3 + 2] = 0;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Use Line for continuous line rendering
        const material = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            linewidth: this.lineWidth
        });
        
        this.spiralLine = new THREE.Line(geometry, material);
        this.scene.add(this.spiralLine);
        
        // Fit camera to show the entire spiral
        this.fitCameraToSpiral(points);
        
        console.timeEnd('updateVisualizationGeometry');
    }

    fitCameraToSpiral(points) {
        // Calculate bounding box
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });

        // Calculate size needed to fit spiral
        const size = Math.max(maxX - minX, maxY - minY);

        // Only update zoom if it's the first spiral or user has zoomed
        if (!this.spiralLine) {
            this.currentZoom = Math.max(size * 1.5, 5);
            this.camera.position.setZ(this.currentZoom);
        }
        
        // Keep camera position stable, only adjust frustum
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = this.currentZoom;
        
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        
        this.camera.updateProjectionMatrix();

        // Update controls
        this.controls.target.copy(this.targetPosition);
        this.controls.update();
    }
} 