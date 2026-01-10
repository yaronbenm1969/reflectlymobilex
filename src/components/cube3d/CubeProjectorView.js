import React, { useRef, useMemo, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { theme } from '../../theme/theme';

const ENABLE_3D_CUBE = true;
const ENTER_THRESHOLD = 25;
const EXIT_THRESHOLD = 55;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CUBE_SIZE = SCREEN_WIDTH * 0.6;

const FACE_ROTATIONS = [
  { x: 0, y: 0 },
  { x: 0, y: Math.PI },
  { x: 0, y: Math.PI / 2 },
  { x: 0, y: -Math.PI / 2 },
  { x: -Math.PI / 2, y: 0 },
  { x: Math.PI / 2, y: 0 },
];

function ImageFace({ position, rotation, textureUrl, faceIndex, isActive }) {
  const meshRef = useRef();
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        textureUrl,
        (loadedTexture) => {
          loadedTexture.minFilter = THREE.LinearFilter;
          loadedTexture.magFilter = THREE.LinearFilter;
          setTexture(loadedTexture);
        },
        undefined,
        (error) => {
          console.log(`❌ Texture load failed for face ${faceIndex}:`, error);
        }
      );
    }
  }, [textureUrl, faceIndex]);

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[1.98, 1.98]} />
      <meshBasicMaterial
        map={texture}
        color={texture ? '#ffffff' : '#333333'}
        transparent={true}
        opacity={isActive ? 1 : 0.85}
      />
    </mesh>
  );
}

const Cube3DInner = forwardRef(function Cube3DInner({ 
  faces, 
  onFaceChange, 
  activeFaceIndex, 
  setActiveFaceIndex,
  targetFaceIndex,
  isVideoPlaying,
  isAdvancing,
}, ref) {
  const groupRef = useRef();
  const [rotationTarget, setRotationTarget] = useState({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });
  const wobblePhase = useRef({ x: Math.random() * Math.PI * 2, y: Math.random() * Math.PI * 2 });
  const lastTargetChange = useRef(Date.now());
  const rotatingToFace = useRef(false);

  const facePositions = useMemo(() => [
    { position: [0, 0, 1], rotation: [0, 0, 0] },
    { position: [0, 0, -1], rotation: [0, Math.PI, 0] },
    { position: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
    { position: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    { position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
    { position: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] },
  ], []);

  useImperativeHandle(ref, () => ({
    rotateTo: (faceIndex) => {
      if (faceIndex >= 0 && faceIndex < 6) {
        const targetRot = FACE_ROTATIONS[faceIndex];
        setRotationTarget({ x: targetRot.x, y: targetRot.y });
        rotatingToFace.current = true;
        console.log(`🎯 Rotating to face ${faceIndex}`);
      }
    },
    addRandomWobble: () => {
      setRotationTarget(prev => ({
        x: prev.x + (Math.random() - 0.5) * 0.3,
        y: prev.y + (Math.random() - 0.5) * 0.3,
      }));
    },
  }), []);

  useEffect(() => {
    if (targetFaceIndex !== undefined && targetFaceIndex >= 0 && targetFaceIndex < 6) {
      const targetRot = FACE_ROTATIONS[targetFaceIndex];
      setRotationTarget({ x: targetRot.x, y: targetRot.y });
      rotatingToFace.current = true;
    }
  }, [targetFaceIndex]);

  const getFaceNormal = useCallback((faceIndex, groupRotation) => {
    const normals = [
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
    ];

    const euler = new THREE.Euler(groupRotation.x, groupRotation.y, 0, 'XYZ');
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    const normal = normals[faceIndex].clone().applyQuaternion(quaternion);
    return normal;
  }, []);

  const checkFaceVisibility = useCallback(() => {
    if (!groupRef.current) return;
    if (isAdvancing) return;

    const cameraDir = new THREE.Vector3(0, 0, 1);
    let bestFace = -1;
    let bestAngle = 180;

    for (let i = 0; i < 6; i++) {
      if (!faces[i]) continue;
      const normal = getFaceNormal(i, currentRotation.current);
      const dot = normal.dot(cameraDir);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

      if (angle < bestAngle) {
        bestAngle = angle;
        bestFace = i;
      }
    }

    if (activeFaceIndex === -1 && !isVideoPlaying) {
      if (bestAngle < ENTER_THRESHOLD && bestFace !== -1 && faces[bestFace]) {
        console.log(`🎯 Face ${bestFace} entered (angle: ${bestAngle.toFixed(1)}°)`);
        setActiveFaceIndex(bestFace);
        onFaceChange?.(bestFace, 'enter');
        rotatingToFace.current = false;
      }
    } else if (activeFaceIndex !== -1) {
      const activeNormal = getFaceNormal(activeFaceIndex, currentRotation.current);
      const activeDot = activeNormal.dot(cameraDir);
      const activeAngle = Math.acos(Math.max(-1, Math.min(1, activeDot))) * (180 / Math.PI);

      if (activeAngle > EXIT_THRESHOLD && !isVideoPlaying) {
        console.log(`👋 Face ${activeFaceIndex} exited (angle: ${activeAngle.toFixed(1)}°)`);
        onFaceChange?.(activeFaceIndex, 'exit');
        setActiveFaceIndex(-1);
      }
    }
  }, [activeFaceIndex, setActiveFaceIndex, onFaceChange, getFaceNormal, faces, isVideoPlaying, isAdvancing]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;
    const wobbleIntensity = isVideoPlaying ? 0.02 : 0.05;
    const wobbleX = Math.sin(time * 0.3 + wobblePhase.current.x) * wobbleIntensity;
    const wobbleY = Math.sin(time * 0.4 + wobblePhase.current.y) * wobbleIntensity;

    if (!isVideoPlaying && !rotatingToFace.current) {
      if (Date.now() - lastTargetChange.current > 5000 + Math.random() * 4000) {
        setRotationTarget(prev => ({
          x: prev.x + (Math.random() - 0.5) * 0.4,
          y: prev.y + (Math.random() - 0.5) * 0.4,
        }));
        lastTargetChange.current = Date.now();
      }
    }

    const lerpFactor = isVideoPlaying ? 0.01 : (rotatingToFace.current ? 0.03 : 0.015);
    currentRotation.current.x += (rotationTarget.x - currentRotation.current.x) * lerpFactor;
    currentRotation.current.y += (rotationTarget.y - currentRotation.current.y) * lerpFactor;

    groupRef.current.rotation.x = currentRotation.current.x + wobbleX;
    groupRef.current.rotation.y = currentRotation.current.y + wobbleY;

    checkFaceVisibility();
  });

  return (
    <group ref={groupRef}>
      {facePositions.map((face, index) => (
        <ImageFace
          key={index}
          faceIndex={index}
          position={face.position}
          rotation={face.rotation}
          textureUrl={faces[index]?.posterThumbUri}
          isActive={activeFaceIndex === index}
        />
      ))}
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        <meshBasicMaterial color="#1a1a2e" transparent opacity={0.3} />
      </mesh>
    </group>
  );
});

function Scene({ faces, onFaceChange, activeFaceIndex, setActiveFaceIndex, targetFaceIndex, isVideoPlaying, isAdvancing, cubeRef }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <Cube3DInner
        ref={cubeRef}
        faces={faces}
        onFaceChange={onFaceChange}
        activeFaceIndex={activeFaceIndex}
        setActiveFaceIndex={setActiveFaceIndex}
        targetFaceIndex={targetFaceIndex}
        isVideoPlaying={isVideoPlaying}
        isAdvancing={isAdvancing}
      />
    </>
  );
}

const CubeProjectorView = forwardRef(function CubeProjectorView({
  faces = [],
  onFaceChange,
  activeFaceIndex = -1,
  setActiveFaceIndex,
  targetFaceIndex,
  isVideoPlaying = false,
  isAdvancing = false,
  onError,
}, ref) {
  const [glError, setGlError] = useState(false);
  const cubeRef = useRef();

  useImperativeHandle(ref, () => ({
    rotateTo: (faceIndex) => cubeRef.current?.rotateTo(faceIndex),
    addRandomWobble: () => cubeRef.current?.addRandomWobble(),
  }), []);

  const handleGLError = useCallback((error) => {
    console.log('❌ GL Error:', error);
    setGlError(true);
    onError?.(error);
  }, [onError]);

  if (glError || !ENABLE_3D_CUBE) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Canvas
        style={styles.canvas}
        gl={{ antialias: true }}
        onCreated={(state) => {
          console.log('✅ 3D Canvas created');
        }}
        onError={handleGLError}
      >
        <Scene
          cubeRef={cubeRef}
          faces={faces}
          onFaceChange={onFaceChange}
          activeFaceIndex={activeFaceIndex}
          setActiveFaceIndex={setActiveFaceIndex}
          targetFaceIndex={targetFaceIndex}
          isVideoPlaying={isVideoPlaying}
          isAdvancing={isAdvancing}
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
    backgroundColor: '#0a0a1a',
  },
  canvas: {
    flex: 1,
  },
});
