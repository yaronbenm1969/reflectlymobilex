import React, { useRef, useMemo, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { theme } from '../../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CUBE_SIZE = SCREEN_WIDTH * 0.7;

const FACE_COLORS = [
  '#FF6B9D',
  '#C06FBB',
  '#8B5CF6',
  '#EC4899',
  '#F472B6',
  '#A855F7',
];

function CubeFace({ position, rotation, textureUrl, faceIndex, isActive, isPlaying }) {
  const meshRef = useRef();
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = 'anonymous';
      loader.load(
        textureUrl,
        (loadedTexture) => {
          loadedTexture.minFilter = THREE.LinearFilter;
          loadedTexture.magFilter = THREE.LinearFilter;
          setTexture(loadedTexture);
        },
        undefined,
        () => {}
      );
    }
  }, [textureUrl, faceIndex]);

  const faceColor = FACE_COLORS[faceIndex % FACE_COLORS.length];

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[1.95, 1.95]} />
      <meshStandardMaterial
        map={texture}
        color={texture ? '#ffffff' : faceColor}
        emissive={isPlaying ? '#FF6B9D' : (isActive ? '#FF6B9D' : '#000000')}
        emissiveIntensity={isPlaying ? 0.6 : (isActive ? 0.3 : 0.1)}
        transparent={true}
        opacity={isPlaying ? 0.15 : 1}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
}

const RotatingCube = forwardRef(function RotatingCube({ 
  faces, 
  onFaceEnterFront,
  onFaceExitFront,
  onFaceTransformUpdate,
  currentVideoDuration,
  isPlaying,
  currentPlayingFaceIndex,
  camera,
}, ref) {
  const groupRef = useRef();
  const faceMeshRefs = useRef([]);
  const rotationY = useRef(0);
  const rotationX = useRef(0);
  const angularVelocityY = useRef(0.35);
  const timeRef = useRef(0);
  const lastFrontFace = useRef(-1);

  const faceConfigs = useMemo(() => [
    { position: [0, 0, 1], rotation: [0, 0, 0], normal: [0, 0, 1] },
    { position: [0, 0, -1], rotation: [0, Math.PI, 0], normal: [0, 0, -1] },
    { position: [1, 0, 0], rotation: [0, Math.PI / 2, 0], normal: [1, 0, 0] },
    { position: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0], normal: [-1, 0, 0] },
    { position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0], normal: [0, 1, 0] },
    { position: [0, -1, 0], rotation: [Math.PI / 2, 0, 0], normal: [0, -1, 0] },
  ], []);

  const faceLocalCorners = useMemo(() => [
    new THREE.Vector3(-0.975, -0.975, 0),
    new THREE.Vector3(0.975, -0.975, 0),
    new THREE.Vector3(0.975, 0.975, 0),
    new THREE.Vector3(-0.975, 0.975, 0),
  ], []);

  const getFrontFace = useCallback((rotX, rotY) => {
    const cameraDir = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler(rotX, rotY, 0, 'XYZ');
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    
    let bestFace = 0;
    let bestDot = -2;
    
    for (let i = 0; i < 6; i++) {
      const normal = new THREE.Vector3(...faceConfigs[i].normal);
      normal.applyQuaternion(quaternion);
      const dot = normal.dot(cameraDir);
      
      if (dot > bestDot) {
        bestDot = dot;
        bestFace = i;
      }
    }
    
    return { faceIndex: bestFace, dot: bestDot };
  }, [faceConfigs]);

  useEffect(() => {
    if (currentVideoDuration && currentVideoDuration > 0) {
      const durationSec = currentVideoDuration / 1000;
      const calculatedSpeed = (Math.PI / 2) / durationSec;
      angularVelocityY.current = Math.max(0.08, Math.min(0.5, calculatedSpeed));
    }
  }, [currentVideoDuration]);

  useImperativeHandle(ref, () => ({
    getRotation: () => ({ x: rotationX.current, y: rotationY.current }),
    getCurrentFace: () => lastFrontFace.current,
  }), []);

  useFrame((state, delta) => {
    if (!groupRef.current || !camera) return;
    
    timeRef.current += delta;

    rotationY.current += delta * angularVelocityY.current;
    rotationX.current = Math.sin(timeRef.current * 0.2) * 0.3;
    const wobbleZ = Math.sin(timeRef.current * 0.35) * 0.04;
    
    groupRef.current.rotation.x = rotationX.current;
    groupRef.current.rotation.y = rotationY.current;
    groupRef.current.rotation.z = wobbleZ;

    const { faceIndex, dot } = getFrontFace(rotationX.current, rotationY.current);
    
    if (faceIndex !== lastFrontFace.current && dot > 0.7) {
      if (lastFrontFace.current !== -1) {
        onFaceExitFront?.(lastFrontFace.current);
      }
      lastFrontFace.current = faceIndex;
      if (faces[faceIndex]?.videoUrl) {
        onFaceEnterFront?.(faceIndex);
      }
    }

    if (currentPlayingFaceIndex >= 0 && currentPlayingFaceIndex < 6) {
      const faceConfig = faceConfigs[currentPlayingFaceIndex];
      const faceEuler = new THREE.Euler(...faceConfig.rotation);
      const faceQuaternion = new THREE.Quaternion().setFromEuler(faceEuler);
      
      const cubeEuler = new THREE.Euler(rotationX.current, rotationY.current, wobbleZ, 'XYZ');
      const cubeQuaternion = new THREE.Quaternion().setFromEuler(cubeEuler);
      
      const faceCenter = new THREE.Vector3(...faceConfig.position);
      faceCenter.applyQuaternion(cubeQuaternion);
      
      const projectedCorners = faceLocalCorners.map(corner => {
        const worldCorner = corner.clone();
        worldCorner.applyQuaternion(faceQuaternion);
        worldCorner.add(new THREE.Vector3(...faceConfig.position));
        worldCorner.applyQuaternion(cubeQuaternion);
        
        const projected = worldCorner.clone().project(camera);
        return {
          x: (projected.x * 0.5 + 0.5) * CUBE_SIZE,
          y: (1 - (projected.y * 0.5 + 0.5)) * CUBE_SIZE,
        };
      });

      const faceNormal = new THREE.Vector3(...faceConfig.normal);
      faceNormal.applyQuaternion(cubeQuaternion);
      const visibility = faceNormal.z;

      onFaceTransformUpdate?.({
        corners: projectedCorners,
        visibility: visibility,
        center: {
          x: (projectedCorners[0].x + projectedCorners[2].x) / 2,
          y: (projectedCorners[0].y + projectedCorners[2].y) / 2,
        },
        width: Math.abs(projectedCorners[1].x - projectedCorners[0].x),
        height: Math.abs(projectedCorners[2].y - projectedCorners[1].y),
      });
    }
  });

  return (
    <group ref={groupRef}>
      {faceConfigs.map((face, index) => (
        <CubeFace
          key={index}
          faceIndex={index}
          position={face.position}
          rotation={face.rotation}
          textureUrl={faces[index]?.posterThumbUri}
          isActive={index === lastFrontFace.current}
          isPlaying={isPlaying && currentPlayingFaceIndex === index}
        />
      ))}
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        <meshBasicMaterial color="#1a1a2e" transparent opacity={0.08} />
      </mesh>
    </group>
  );
});

function Scene({ faces, onFaceEnterFront, onFaceExitFront, onFaceTransformUpdate, currentVideoDuration, isPlaying, currentPlayingFaceIndex, cubeRef }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 4.2);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[5, 5, 5]} intensity={0.7} />
      <pointLight position={[-5, -5, 5]} intensity={0.4} color="#FF6B9D" />
      <pointLight position={[0, 0, 6]} intensity={0.5} color="#ffffff" />
      <RotatingCube
        ref={cubeRef}
        faces={faces}
        onFaceEnterFront={onFaceEnterFront}
        onFaceExitFront={onFaceExitFront}
        onFaceTransformUpdate={onFaceTransformUpdate}
        currentVideoDuration={currentVideoDuration}
        isPlaying={isPlaying}
        currentPlayingFaceIndex={currentPlayingFaceIndex}
        camera={camera}
      />
    </>
  );
}

const CubeProjectorView = forwardRef(function CubeProjectorView({
  faces = [],
  onFaceEnterFront,
  onFaceExitFront,
  onFaceTransformUpdate,
  currentVideoDuration,
  isPlaying = false,
  currentPlayingFaceIndex = -1,
  onError,
}, ref) {
  const [glError, setGlError] = useState(false);
  const cubeRef = useRef();

  useImperativeHandle(ref, () => ({
    getRotation: () => cubeRef.current?.getRotation(),
    getCurrentFace: () => cubeRef.current?.getCurrentFace(),
  }), []);

  const handleGLError = useCallback((error) => {
    setGlError(true);
    onError?.(error);
  }, [onError]);

  if (glError) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Canvas
        style={styles.canvas}
        gl={{ antialias: true }}
        onError={handleGLError}
      >
        <Scene
          cubeRef={cubeRef}
          faces={faces}
          onFaceEnterFront={onFaceEnterFront}
          onFaceExitFront={onFaceExitFront}
          onFaceTransformUpdate={onFaceTransformUpdate}
          currentVideoDuration={currentVideoDuration}
          isPlaying={isPlaying}
          currentPlayingFaceIndex={currentPlayingFaceIndex}
        />
      </Canvas>
    </View>
  );
});

export default CubeProjectorView;

const styles = StyleSheet.create({
  container: {
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    alignSelf: 'center',
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
