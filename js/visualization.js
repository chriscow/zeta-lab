import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ZetaMath } from './math.js';
import Stats from 'three/addons/libs/stats.module.js';

export class ZetaVisualization {
    constructor(container) {
        // console.log('Initializing ZetaVisualization');
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
            alpha: true 
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setClearColor(0x000000, 0.1);
        container.appendChild(this.renderer.domElement);

        // Setup camera for perfect top-down view
        this.camera.position.set(0, 0, 10);
        this.camera.up.set(0, 1, 0); // Ensure up vector is aligned with Y axis
        this.camera.lookAt(0, 0, 0);

        // Add lights
        // const ambientLight = new THREE.AmbientLight(0x404040);
        // const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        // directionalLight.position.set(1, 1, 1);
        // this.scene.add(ambientLight);
        // this.scene.add(directionalLight);

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
        this.pointCounts = {
            original: 0,
            downsampled: 0
        };

        // Add step size configuration
        this.useAdaptiveStep = true;
        this.stepSizeFactor = 1.0;

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // console.log('ZetaVisualization initialized');
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

    animate() {
        requestAnimationFrame(() => this.animate());
        this.stats.begin();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        this.stats.end();
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
        let t1, t2;
        
        try {
            // Create step size configuration
            const stepConfig = {
                useAdaptive: this.useAdaptiveStep,
                factor: this.stepSizeFactor
            };

            // Calculate spiral points using selected method
            let { points, zeta } = this.useParallelCalculation ?
                await ZetaMath.calculateSpiralParallel(real, index, formula, useNewImag, stepConfig) :
                await ZetaMath.calculateSpiral(real, index, formula, useNewImag, stepConfig);

            t1 = performance.now();
            console.log(`[PERF] Spiral calculation: ${(t1 - t0).toFixed(2)}ms, Points: ${points.length}`);

            // Store original point count
            this.pointCounts.original = points.length;
            this.pointCounts.downsampled = points.length;

            // Apply downsampling if enabled
            if (this.useDownsampling) {
                const complexPoints = points.map(p => ({ real: p.x, imag: p.y }));
                const downsampledPoints = ZetaMath.downsampleComplex(complexPoints, 1000, this.downsamplingAggressiveness);
                points = downsampledPoints.map(p => ({ x: p.real, y: p.imag, z: 0 }));
                this.pointCounts.downsampled = points.length;
                
                t2 = performance.now();
                console.log(`[PERF] Downsampling: ${(t2 - t1).toFixed(2)}ms, Points reduced: ${this.pointCounts.original} -> ${points.length}`);
            }

            // Update the visualization with the new points
            this.updateVisualizationGeometry(points);
            
            const t3 = performance.now();
            console.log(`[PERF] Geometry update: ${(t3 - (this.useDownsampling ? t2 : t1)).toFixed(2)}ms`);
            console.log(`[PERF] Total time: ${(t3 - t0).toFixed(2)}ms`);

            // Notify about zeta update
            if (this.onZetaUpdate) {
                this.onZetaUpdate(zeta);
            }
        } catch (error) {
            console.error('Error updating spiral:', error);
            console.error('Stack:', error.stack);
        }
    }

    updateVisualizationGeometry(points) {
        console.log(`[RENDER] Creating geometry with ${points.length} points`);
        const t0 = performance.now();

        // Remove existing line if it exists
        if (this.spiralLine) {
            this.scene.remove(this.spiralLine);
            this.spiralLine.geometry.dispose();
            this.spiralLine.material.dispose();
        }

        // Create geometry from points
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(points.length * 3);
        
        // Fill positions array
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            positions[i * 3] = point.x || point.real || 0;     // x or real
            positions[i * 3 + 1] = point.y || point.imag || 0; // y or imag
            positions[i * 3 + 2] = 0;                          // z
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create and add the new line
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        this.spiralLine = new THREE.Line(geometry, material);
        this.scene.add(this.spiralLine);

        const t1 = performance.now();
        console.log(`[RENDER] Geometry creation took ${(t1 - t0).toFixed(2)}ms`);
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