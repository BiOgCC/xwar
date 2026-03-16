import '@react-three/fiber'

declare module '@react-three/fiber' {
  interface ThreeElements {
    // This ensures R3F elements like <mesh>, <group>, <ambientLight> etc.
    // are recognized as valid JSX intrinsic elements.
  }
}

// Extend JSX.IntrinsicElements with Three.js elements from R3F
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      group: any
      mesh: any
      ambientLight: any
      directionalLight: any
      hemisphereLight: any
      pointLight: any
      spotLight: any
      fog: any
      gridHelper: any
      // Geometries
      boxGeometry: any
      sphereGeometry: any
      cylinderGeometry: any
      coneGeometry: any
      planeGeometry: any
      dodecahedronGeometry: any
      // Materials
      meshStandardMaterial: any
      meshBasicMaterial: any
      meshPhongMaterial: any
    }
  }
}
