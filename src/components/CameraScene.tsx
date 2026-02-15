"use client";

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Environment, Float, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function CameraModel(props: React.ComponentProps<'group'>) {
    const { scene } = useGLTF('/models/yashica_tl-super_-_old_camera.glb');
    const group = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (group.current) {
            group.current.rotation.y += delta * 0.2;
        }
    });

    return (
        <group ref={group} {...props}>
            <primitive object={scene} />
        </group>
    );
}

export default function CameraScene() {
    return (
        <div className="w-full h-[500px] md:h-[600px] relative">
            <Canvas shadows onCreated={({ gl }) => { gl.setClearColor(new THREE.Color(0x000000), 0) }}>
                <PerspectiveCamera makeDefault position={[0, 1, 10]} fov={35} />

                {/* OrbitControls removed to prevent user interaction */}

                <Environment preset="studio" />
                <ambientLight intensity={0.8} />
                <spotLight position={[5, 10, 5]} angle={0.5} penumbra={1} intensity={2} castShadow />
                <pointLight position={[-10, 5, -10]} intensity={1} color="#4455ff" />

                <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
                    <React.Suspense fallback={null}>
                        <CameraModel position={[0, 1.0, 0]} scale={9} rotation={[0, Math.PI, 0]} />
                    </React.Suspense>
                </Float>
            </Canvas>
        </div>
    );
}

useGLTF.preload('/models/yashica_tl-super_-_old_camera.glb');

