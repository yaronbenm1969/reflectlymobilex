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
        emissiveIntensity={isPlaying ? 0.8 : (isActive ? 0.4 : 0.1)}
        transparent={true}
        opacity={isPlaying ? 0.3 : 1}
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
  currentVideoDuration,
  isPlaying,
  currentPlayingFaceIndex,
}, ref) {
  const groupRef = useRef();
  const rotationY = useRef(0);
  const rotationX = useRef(-0.15);
  const angularVelocity = useRef(0.4);
  const lastFrontFace = useRef(-1);
  const faceEnteredAt = useRef(null);

  const facePositions = useMemo(() => [
    { position: [0, 0, 1], rotation: [0, 0, 0] },
    { position: [0, 0, -1], rotation: [0, Math.PI, 0] },
    { position: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
    { position: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    { position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
    { position: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] },
  ], []);

  const getFrontFaceIndex = useCallback((rotY) => {
    const normalized = ((rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (normalized < Math.PI / 4 || normalized >= Math.PI * 7 / 4) return 0;
    if (normalized >= Math.PI / 4 && normalized < Math.PI * 3 / 4) return 3;
    if (normalized >= Math.PI * 3 / 4 && normalized < Math.PI * 5 / 4) return 1;
    if (normalized >= Math.PI * 5 / 4 && normalized < Math.PI * 7 / 4) return 2;
    return 0;
  }, []);

  useEffect(() => {
    if (currentVideoDuration && currentVideoDuration > 0) {
      const minSpeed = 0.15;
      const maxSpeed = 0.8;
      const durationSec = currentVideoDuration / 1000;
      const calculatedSpeed = (Math.PI / 2) / durationSec;
      angularVelocity.current = Math.max(minSpeed, Math.min(maxSpeed, calculatedSpeed));
      console.log(`🎬 Rotation speed set to ${angularVelocity.current.toFixed(3)} for ${durationSec.toFixed(1)}s video`);
    }
  }, [currentVideoDuration]);

  useImperativeHandle(ref, () => ({
    setSpeed: (speed) => {
      angularVelocity.current = speed;
    },
    getCurrentFace: () => getFrontFaceIndex(rotationY.current),
  }), [getFrontFaceIndex]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    rotationY.current += delta * angularVelocity.current;

    const wobbleX = Math.sin(state.clock.elapsedTime * 0.5) * 0.03;
    const wobbleZ = Math.sin(state.clock.elapsedTime * 0.3) * 0.02;
    
    groupRef.current.rotation.x = rotationX.current + wobbleX;
    groupRef.current.rotation.y = rotationY.current;
    groupRef.current.rotation.z = wobbleZ;

    const frontFace = getFrontFaceIndex(rotationY.current);
    
    if (frontFace !== lastFrontFace.current) {
      if (lastFrontFace.current !== -1 && faces[lastFrontFace.current]) {
        onFaceExitFront?.(lastFrontFace.current);
      }
      
      lastFrontFace.current = frontFace;
      faceEnteredAt.current = state.clock.elapsedTime;
      
      if (faces[frontFace] && faces[frontFace].videoUrl) {
        console.log(`🎲 Face ${frontFace} entering front`);
        onFaceEnterFront?.(frontFace);
      }
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
        <meshBasicMaterial color="#1a1a2e" transparent opacity={0.15} />
      </mesh>
    </group>
  );
});

function Scene({ faces, onFaceEnterFront, onFaceExitFront, currentVideoDuration, isPlaying, currentPlayingFaceIndex, cubeRef }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 4.2);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={1.0} />
      <pointLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, -5, 5]} intensity={0.4} color="#FF6B9D" />
      <pointLight position={[0, 0, 6]} intensity={0.6} color="#ffffff" />
      <RotatingCube
        ref={cubeRef}
        faces={faces}
        onFaceEnterFront={onFaceEnterFront}
        onFaceExitFront={onFaceExitFront}
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
  currentVideoDuration,
  isPlaying = false,
  currentPlayingFaceIndex = -1,
  onError,
}, ref) {
  const [glError, setGlError] = useState(false);
  const cubeRef = useRef();

  useImperativeHandle(ref, () => ({
    setSpeed: (speed) => cubeRef.current?.setSpeed(speed),
    getCurrentFace: () => cubeRef.current?.getCurrentFace(),
  }), []);

  const handleGLError = useCallback((error) => {
    console.log('GL Error:', error);
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
        onCreated={() => console.log('3D Cube ready')}
        onError={handleGLError}
      >
        <Scene
          cubeRef={cubeRef}
          faces={faces}
          onFaceEnterFront={onFaceEnterFront}
          onFaceExitFront={onFaceExitFront}
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
