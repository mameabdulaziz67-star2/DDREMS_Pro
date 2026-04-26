import { useEffect, useRef, useState } from 'react';
import './Property3DViewer.css';

// Load Three.js from CDN
const loadThreeJS = () => {
  return new Promise((resolve, reject) => {
    if (window.THREE) {
      console.log('Three.js already loaded');
      resolve(window.THREE);
      return;
    }
    console.log('Loading Three.js from CDN...');
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = () => {
      if (window.THREE) {
        console.log('Three.js loaded successfully');
        resolve(window.THREE);
      } else {
        reject(new Error('Three.js failed to load'));
      }
    };
    script.onerror = () => {
      console.error('Failed to load Three.js script');
      reject(new Error('Failed to load Three.js script'));
    };
    document.head.appendChild(script);
  });
};

const Property3DViewer = ({ property, onClose }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const buildingRef = useRef(null);
  const animationIdRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rotationSpeed, setRotationSpeed] = useState(0.005);

  useEffect(() => {
    const initScene = async () => {
      try {
        console.log('Initializing 3D scene...');
        const THREE = await loadThreeJS();
        
        if (!canvasRef.current) {
          console.error('Canvas ref not available');
          setError('Canvas not found');
          return;
        }

        console.log('Canvas found, setting up scene...');

        // Fetch property images
        let propertyWithImages = { ...property };
        try {
          const response = await fetch(`/api/property-images/property/${property.id}`);
          if (response.ok) {
            const images = await response.json();
            propertyWithImages.images = images;
            console.log('Loaded', images.length, 'property images');
          }
        } catch (e) {
          console.warn('Failed to fetch property images:', e);
        }

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        sceneRef.current = scene;

        // Camera setup
        const width = canvasRef.current.clientWidth;
        const height = canvasRef.current.clientHeight;
        console.log('Canvas dimensions:', width, 'x', height);
        
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 5, 8);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowShadowMap;
        
        canvasRef.current.appendChild(renderer.domElement);
        console.log('Renderer added to DOM');
        rendererRef.current = renderer;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        scene.add(directionalLight);

        // Create building with images
        const building = createBuilding(propertyWithImages, THREE);
        scene.add(building);
        buildingRef.current = building;
        console.log('Building created and added to scene');

        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(30, 30);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90ee90 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Add trees
        addTrees(scene, THREE);

        setIsLoading(false);
        console.log('Scene initialized successfully');

        // Animation loop
        let isAnimating = true;
        const animate = () => {
          if (!isAnimating) return;
          animationIdRef.current = requestAnimationFrame(animate);
          if (buildingRef.current) {
            buildingRef.current.rotation.y += rotationSpeed;
          }
          renderer.render(scene, camera);
        };

        animate();

        // Handle window resize
        const handleResize = () => {
          if (!canvasRef.current) return;
          const newWidth = canvasRef.current.clientWidth;
          const newHeight = canvasRef.current.clientHeight;
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        };

        window.addEventListener('resize', handleResize);

        return () => {
          isAnimating = false;
          if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
          }
          window.removeEventListener('resize', handleResize);
          
          // Dispose of geometries and materials
          scene.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
          
          renderer.dispose();
          if (canvasRef.current && renderer.domElement.parentNode === canvasRef.current) {
            canvasRef.current.removeChild(renderer.domElement);
          }
        };
      } catch (err) {
        console.error('Error initializing 3D scene:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    initScene();
  }, [property]);

  const createBuilding = (prop, THREE) => {
    const group = new THREE.Group();
    const width = prop.width || 8;
    const depth = prop.depth || 6;
    const height = prop.floors ? prop.floors * 3 : 9;

    // Create texture loader
    const textureLoader = new THREE.TextureLoader();
    const materials = [];
    const images = prop.images || [];
    const defaultColor = 0xd4a574;

    // Create materials for each face
    for (let i = 0; i < 6; i++) {
      let material;
      if (images[i] && images[i].image_url) {
        try {
          const texture = textureLoader.load(images[i].image_url);
          texture.magFilter = THREE.LinearFilter;
          texture.minFilter = THREE.LinearFilter;
          material = new THREE.MeshPhongMaterial({ map: texture });
          console.log('Loaded texture', i, ':', images[i].image_url);
        } catch (e) {
          console.warn('Failed to load texture:', images[i].image_url);
          material = new THREE.MeshPhongMaterial({ color: defaultColor });
        }
      } else {
        material = new THREE.MeshPhongMaterial({ color: defaultColor });
      }
      materials.push(material);
    }

    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const buildingMesh = new THREE.Mesh(buildingGeometry, materials);
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    buildingMesh.position.y = height / 2;
    group.add(buildingMesh);

    // Add windows
    const windowColor = 0x87ceeb;
    const windowSize = 0.8;
    const windowSpacing = 1.2;

    for (let floor = 0; floor < (prop.floors || 3); floor++) {
      for (let col = 0; col < 3; col++) {
        const windowGeometry = new THREE.BoxGeometry(windowSize, windowSize, 0.1);
        const windowMaterial = new THREE.MeshPhongMaterial({ color: windowColor });
        const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
        window1.position.set(
          -width / 2 + 1.5 + col * windowSpacing,
          height - (floor + 1) * 3 + 1.5,
          depth / 2 + 0.05
        );
        group.add(window1);

        const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
        window2.position.set(
          -width / 2 + 1.5 + col * windowSpacing,
          height - (floor + 1) * 3 + 1.5,
          -depth / 2 - 0.05
        );
        group.add(window2);
      }
    }

    // Roof
    const roofGeometry = new THREE.ConeGeometry(Math.max(width, depth) / 1.5, 2, 4);
    const roofMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.castShadow = true;
    roof.position.y = height + 1;
    group.add(roof);

    // Door
    const doorGeometry = new THREE.BoxGeometry(1.5, 2.5, 0.1);
    const doorMaterial = new THREE.MeshPhongMaterial({ color: 0x654321 });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 1.25, depth / 2 + 0.05);
    group.add(door);

    return group;
  };

  const addTrees = (scene, THREE) => {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const distance = 12;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 4, 8);
      const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.set(x, 2, z);
      trunk.castShadow = true;
      scene.add(trunk);

      const foliageGeometry = new THREE.SphereGeometry(3, 8, 8);
      const foliageMaterial = new THREE.MeshPhongMaterial({ color: 0x228b22 });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.set(x, 6, z);
      foliage.castShadow = true;
      scene.add(foliage);
    }
  };

  if (error) {
    return (
      <div className="property-3d-viewer-overlay">
        <div className="property-3d-viewer-container">
          <div className="viewer-header">
            <h2>🏢 3D Property View - Error</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="viewer-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'red', fontSize: '18px', textAlign: 'center' }}>
              <p>Error loading 3D viewer:</p>
              <p>{error}</p>
              <p>Please check the browser console for more details.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="property-3d-viewer-overlay">
      <div className="property-3d-viewer-container">
        <div className="viewer-header">
          <h2>🏢 3D Property View - {property.title || 'Property'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="viewer-content">
          <div ref={canvasRef} className="viewer-canvas" />

          <div className="viewer-controls">
            <div className="control-group">
              <label>Rotation Speed</label>
              <input
                type="range"
                min="0"
                max="0.02"
                step="0.001"
                value={rotationSpeed}
                onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
                className="slider"
              />
              <span className="value">{(rotationSpeed * 1000).toFixed(1)}x</span>
            </div>

            <div className="property-info">
              <h3>Property Details</h3>
              <p><strong>Type:</strong> {property.property_type || 'Residential'}</p>
              <p><strong>Bedrooms:</strong> {property.bedrooms || 'N/A'}</p>
              <p><strong>Bathrooms:</strong> {property.bathrooms || 'N/A'}</p>
              <p><strong>Area:</strong> {property.area || 'N/A'} m²</p>
              <p><strong>Price:</strong> ${property.price?.toLocaleString() || 'N/A'}</p>
              <p><strong>Location:</strong> {property.location || 'N/A'}</p>
            </div>
          </div>
        </div>

        {isLoading && <div className="loading-spinner">Loading 3D Model...</div>}
      </div>
    </div>
  );
};

export default Property3DViewer;
