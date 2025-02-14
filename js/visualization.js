import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ZetaMath } from './math.js';
import Stats from 'three/addons/libs/stats.module.js';

export class ZetaVisualization {
    constructor(container) {
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

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        console.log('ZetaVisualization initialized');
    }

    setAutoRotate(enabled) {
        // Remove auto-rotate functionality
        console.log('Auto-rotate functionality has been removed');
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
        console.log('Setting parallel calculation:', enabled);
        this.useParallelCalculation = enabled;
    }

    setRiemannSiegel(enabled) {
        console.log('Calculate Riemann-Siegel:', enabled);
        this.useRiemannSiegel = enabled;
    }

    async updateSpiral(real, index, formula, useNewImag = true) {
        console.log('Updating spiral:', { 
            real, 
            index, 
            formula, 
            useNewImag,
            useParallel: this.useParallelCalculation,
            useRiemannSiegel: this.useRiemannSiegel
        });
        
        try {
            // Calculate spiral points using selected method
            const { points, zeta } = this.useParallelCalculation ?
                await ZetaMath.calculateSpiralParallel(real, index, formula, useNewImag, this.useRiemannSiegel) :
                await ZetaMath.calculateSpiral(real, index, formula, useNewImag, this.useRiemannSiegel);

            console.log('Calculated points:', points.length, 'Zeta:', zeta);

            // Notify about zeta update
            if (this.onZetaUpdate) {
                this.onZetaUpdate(zeta);
            }

            // Remove old elements
            if (this.spiralLine) {
                this.scene.remove(this.spiralLine);
            }
            if (this.zetaPoint) {
                this.scene.remove(this.zetaPoint);
            }
            if (this.targetGroup) {
                this.scene.remove(this.targetGroup);
            }
            if (this.originGroup) {
                this.scene.remove(this.originGroup);
            }

            // Create new spiral geometry
            const geometry = new THREE.BufferGeometry();
            const vertices = new Float32Array(points.length * 3);
            
            points.forEach((point, i) => {
                vertices[i * 3] = point.x;
                vertices[i * 3 + 1] = point.y;
                vertices[i * 3 + 2] = point.z;
            });
            
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

            // Create spiral line with thicker material
            const material = new THREE.LineBasicMaterial({ 
                color: 0x00ff00,
                linewidth: 2 
            });
            this.spiralLine = new THREE.Line(geometry, material);
            this.scene.add(this.spiralLine);

            // Add a special marker for the first link
            const firstLinkGeometry = new THREE.BufferGeometry();
            const firstLinkVertices = new Float32Array([
                points[0].x, points[0].y, points[0].z,
                points[1].x, points[1].y, points[1].z
            ]);
            firstLinkGeometry.setAttribute('position', new THREE.BufferAttribute(firstLinkVertices, 3));
            const firstLinkMaterial = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 3 });
            const firstLink = new THREE.Line(firstLinkGeometry, firstLinkMaterial);
            this.scene.add(firstLink);

            // Create zeta point with crosshair target
            const targetGroup = new THREE.Group();
            
            // Create ring
            const ringGeometry = new THREE.RingGeometry(0.025, 0.05, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff8000, // orange color
                opacity: 0.5,
                transparent: true,
                side: THREE.DoubleSide 
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            targetGroup.add(ring);

            // Create crosshair lines
            const linesMaterial = new THREE.LineBasicMaterial({ 
                color: 0xff8000,
                opacity: 0.5,
                transparent: true
            });

            // Horizontal line
            const horizontalGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-0.025, 0, 0),
                new THREE.Vector3(0.025, 0, 0)
            ]);
            const horizontalLine = new THREE.Line(horizontalGeometry, linesMaterial);
            targetGroup.add(horizontalLine);

            // Diagonal lines
            const r = 0.05;
            const diagonalGeometry1 = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-r, -r, 0),
                new THREE.Vector3(r, r, 0)
            ]);
            const diagonalLine1 = new THREE.Line(diagonalGeometry1, linesMaterial);
            targetGroup.add(diagonalLine1);

            const diagonalGeometry2 = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-r, r, 0),
                new THREE.Vector3(r, r, 0)
            ]);
            const diagonalLine2 = new THREE.Line(diagonalGeometry2, linesMaterial);
            targetGroup.add(diagonalLine2);

            const diagonalGeometry3 = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-r, -r, 0),
                new THREE.Vector3(r, -r, 0)
            ]);
            const diagonalLine3 = new THREE.Line(diagonalGeometry3, linesMaterial);
            targetGroup.add(diagonalLine3);

            // Add origin crosshair
            const originGroup = new THREE.Group();
            
            // Origin ring
            const originRingGeometry = new THREE.RingGeometry(0.025, 0.05, 32);
            const originRingMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff8000,
                opacity: 0.25,
                transparent: true,
                side: THREE.DoubleSide 
            });
            const originRing = new THREE.Mesh(originRingGeometry, originRingMaterial);
            originGroup.add(originRing);

            // Origin cross
            const originLinesMaterial = new THREE.LineBasicMaterial({ 
                color: 0xff8000,
                opacity: 0.25,
                transparent: true
            });
            const originCrossSize = 0.1;
            const originCrossGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-originCrossSize/2, 0, 0),
                new THREE.Vector3(originCrossSize/2, 0, 0),
                new THREE.Vector3(0, -originCrossSize/2, 0),
                new THREE.Vector3(0, originCrossSize/2, 0)
            ]);
            const originCross = new THREE.LineSegments(originCrossGeometry, originLinesMaterial);
            originGroup.add(originCross);

            // Position the target at zeta
            targetGroup.position.set(zeta.real, zeta.imag, 0);
            this.scene.add(targetGroup);
            this.scene.add(originGroup);

            // Store references to groups for cleanup
            this.targetGroup = targetGroup;
            this.originGroup = originGroup;

            // Update debug output
            const debugOutput = document.getElementById('debug-output');
            if (debugOutput) {
                const firstLinkVector = {
                    x: points[1].x - points[0].x,
                    y: points[1].y - points[0].y
                };
                const firstLinkAngle = Math.atan2(firstLinkVector.y, firstLinkVector.x) * 180 / Math.PI;
                
                debugOutput.textContent = `
Real: ${real}
Index: ${index}
Imag: ${ZetaMath.indexToImag(index, useNewImag)}
Zeta: ${zeta.toString()}
Points: ${points.length}
First Link Vector: (${firstLinkVector.x.toFixed(4)}, ${firstLinkVector.y.toFixed(4)})
First Link Angle: ${firstLinkAngle.toFixed(2)}°
First Point: (${points[0].x.toFixed(4)}, ${points[0].y.toFixed(4)}, ${points[0].z.toFixed(4)})
Second Point: (${points[1].x.toFixed(4)}, ${points[1].y.toFixed(4)}, ${points[1].z.toFixed(4)})
Last Point: (${points[points.length-1].x.toFixed(4)}, ${points[points.length-1].y.toFixed(4)}, ${points[points.length-1].z.toFixed(4)})
                `.trim();
            }

            // Adjust camera to fit the spiral
            this.fitCameraToSpiral(points);
        } catch (error) {
            console.error('Error updating spiral:', error);
        }
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