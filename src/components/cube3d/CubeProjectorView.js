import React, { useRef, useMemo, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
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
        opacity={isPlaying ? 0.2 : 1}
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
}, ref) {
  const groupRef = useRef();
  const rotationY = useRef(0);
  const rotationX = useRef(0);
  const angularVelocityY = useRef(0.35);
  const angularVelocityX = useRef(0.12);
  const lastFrontFace = useRef(-1);
  const timeRef = useRef(0);

  const facePositions = useMemo(() => [
    { position: [0, 0, 1], rotation: [0, 0, 0], normal: [0, 0, 1] },
    { position: [0, 0, -1], rotation: [0, Math.PI, 0], normal: [0, 0, -1] },
    { position: [1, 0, 0], rotation: [0, Math.PI / 2, 0], normal: [1, 0, 0] },
    { position: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0], normal: [-1, 0, 0] },
    { position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0], normal: [0, 1, 0] },
    { position: [0, -1, 0], rotation: [Math.PI / 2, 0, 0], normal: [0, -1, 0] },
  ], []);

  const getFrontFaceAndAngle = useCallback((rotX, rotY) => {
    const cameraDir = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler(rotX, rotY, 0, 'XYZ');
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    
    let bestFace = 0;
    let bestDot = -2;
    let bestAngle = 180;
    
    for (let i = 0; i < 6; i++) {
      const normal = new THREE.Vector3(...facePositions[i].normal);
      normal.applyQuaternion(quaternion);
      const dot = normal.dot(cameraDir);
      
      if (dot > bestDot) {
        bestDot = dot;
        bestFace = i;
        bestAngle = Math.acos(Math.min(1, Math.max(-1, dot))) * (180 / Math.PI);
      }
    }
    
    return { faceIndex: bestFace, angle: bestAngle, dot: bestDot };
  }, [facePositions]);

  useEffect(() => {
    if (currentVideoDuration && currentVideoDuration > 0) {
      const durationSec = currentVideoDuration / 1000;
      const calculatedSpeed = (Math.PI / 2) / durationSec;
      angularVelocityY.current = Math.max(0.1, Math.min(0.6, calculatedSpeed));
      angularVelocityX.current = angularVelocityY.current * 0.3;
    }
  }, [currentVideoDuration]);

  useImperativeHandle(ref, () => ({
    getRotation: () => ({ x: rotationX.current, y: rotationY.current }),
    getCurrentFace: () => lastFrontFace.current,
  }), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    timeRef.current += delta;

    rotationY.current += delta * angularVelocityY.current;
    rotationX.current = Math.sin(timeRef.current * 0.25) * 0.4;

    const wobbleZ = Math.sin(timeRef.current * 0.4) * 0.05;
    
    groupRef.current.rotation.x = rotationX.current;
    groupRef.current.rotation.y = rotationY.current;
    groupRef.current.rotation.z = wobbleZ;

    const { faceIndex, angle, dot } = getFrontFaceAndAngle(rotationX.current, rotationY.current);
    
    if (faceIndex !== lastFrontFace.current && angle < 45) {
      if (lastFrontFace.current !== -1) {
        onFaceExitFront?.(lastFrontFace.current);
      }
      
      lastFrontFace.current = faceIndex;
      
      if (faces[faceIndex] && faces[faceIndex].videoUrl) {
        onFaceEnterFront?.(faceIndex);
      }
    }

    if (currentPlayingFaceIndex >= 0 && currentPlayingFaceIndex < 6) {
      const faceNormal = new THREE.Vector3(...facePositions[currentPlayingFaceIndex].normal);
      const euler = new THREE.Euler(rotationX.current, rotationY.current, wobbleZ, 'XYZ');
      const quaternion = new THREE.Quaternion().setFromEuler(euler);
      faceNormal.applyQuaternion(quaternion);
      
      const faceRotX = Math.asin(-faceNormal.y);
      const faceRotY = Math.atan2(faceNormal.x, faceNormal.z);
      
      onFaceTransformUpdate?.({
        rotateX: faceRotX * (180 / Math.PI),
        rotateY: faceRotY * (180 / Math.PI),
        rotateZ: wobbleZ * (180 / Math.PI),
        scale: 0.85 + Math.max(0, faceNormal.z) * 0.15,
        opacity: Math.max(0.3, faceNormal.z),
      });
    }
  });

  return (
    <group ref={groupRef}>
      {facePositions.map((face, index) => (
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
        <meshBasicMaterial color="#1a1a2e" transparent opacity={0.1} />
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
