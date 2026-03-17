import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { DivisionType } from '../../stores/armyStore'
import { DIVISION_TEMPLATES } from '../../stores/armyStore'
import { useBattleStore } from '../../stores/battleStore'

// ====== TERRAIN CONFIGS ======

interface TerrainConfig {
  groundColor: string
  groundColor2: string
  fogColor: string
  skyColor: string
  ambientIntensity: number
  directionalColor: string
  features: string
  heightVariation: number
}

type TerrainType = 'plains' | 'forest' | 'mountain' | 'urban' | 'desert' | 'jungle' | 'arctic' | 'coastal'

const TERRAIN_CONFIGS: Record<TerrainType, TerrainConfig> = {
  plains: {
    groundColor: '#4a7c4f', groundColor2: '#5a8c5f',
    fogColor: '#87CEEB', skyColor: '#87CEEB',
    ambientIntensity: 0.6, directionalColor: '#ffd700',
    features: 'grass', heightVariation: 0.3,
  },
  forest: {
    groundColor: '#2d5a2d', groundColor2: '#1a4a1a',
    fogColor: '#4a6a4a', skyColor: '#6B8E6B',
    ambientIntensity: 0.4, directionalColor: '#d4a574',
    features: 'trees', heightVariation: 0.5,
  },
  mountain: {
    groundColor: '#6b6b6b', groundColor2: '#8a8a8a',
    fogColor: '#b0c4de', skyColor: '#4682B4',
    ambientIntensity: 0.5, directionalColor: '#ffffff',
    features: 'rocks', heightVariation: 2.0,
  },
  urban: {
    groundColor: '#555555', groundColor2: '#444444',
    fogColor: '#808080', skyColor: '#696969',
    ambientIntensity: 0.5, directionalColor: '#dcdcdc',
    features: 'buildings', heightVariation: 0.1,
  },
  desert: {
    groundColor: '#c2a645', groundColor2: '#d4b84f',
    fogColor: '#f5deb3', skyColor: '#87CEEB',
    ambientIntensity: 0.8, directionalColor: '#fff8dc',
    features: 'dunes', heightVariation: 0.6,
  },
  jungle: {
    groundColor: '#1a3a1a', groundColor2: '#0d2d0d',
    fogColor: '#2d4a2d', skyColor: '#3a5a3a',
    ambientIntensity: 0.3, directionalColor: '#98fb98',
    features: 'dense_trees', heightVariation: 0.8,
  },
  arctic: {
    groundColor: '#e8e8f0', groundColor2: '#d0d0e0',
    fogColor: '#f0f0ff', skyColor: '#b0c4de',
    ambientIntensity: 0.7, directionalColor: '#f0f8ff',
    features: 'snow', heightVariation: 0.4,
  },
  coastal: {
    groundColor: '#c2b280', groundColor2: '#a0a070',
    fogColor: '#87CEEB', skyColor: '#4ca6e8',
    ambientIntensity: 0.6, directionalColor: '#ffd700',
    features: 'beach', heightVariation: 0.2,
  },
}

// ====== TERRAIN HEIGHT SAMPLING ======

function getTerrainHeight(x: number, z: number, heightVariation: number): number {
  const h1 = Math.sin(x * 0.3) * Math.cos(z * 0.3) * heightVariation
  const h2 = Math.sin(x * 0.7 + 1.3) * Math.cos(z * 0.5 + 0.7) * heightVariation * 0.5
  const h3 = Math.sin(x * 1.5 + 2.1) * Math.cos(z * 1.2 + 1.4) * heightVariation * 0.25
  return h1 + h2 + h3
}

// ====== UNIT COLORS ======

const UNIT_COLORS: Record<DivisionType, { body: string; accent: string }> = {
  recon:   { body: '#5a8c5a', accent: '#3d6b3d' },
  assault: { body: '#6a7a3a', accent: '#4a5a2a' },
  sniper:  { body: '#4a6a4a', accent: '#2a4a2a' },
  rpg:     { body: '#7a6a3a', accent: '#5a4a2a' },
  jeep:    { body: '#6a6a6a', accent: '#4a4a4a' },
  tank:    { body: '#5a5a5a', accent: '#3a3a3a' },
  jet:     { body: '#4a5a7a', accent: '#2a3a5a' },
  warship: { body: '#3a4a6a', accent: '#1a2a4a' },
}

// ====== TERRAIN GROUND ======

function TerrainGround({ terrain }: { terrain: TerrainType }) {
  const config = TERRAIN_CONFIGS[terrain]

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(80, 80, 80, 80)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      pos.setZ(i, getTerrainHeight(x, y, config.heightVariation))
    }
    geo.computeVertexNormals()
    return geo
  }, [terrain, config.heightVariation])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={geometry}>
      <meshStandardMaterial
        color={config.groundColor}
        roughness={0.9}
        metalness={0.1}
        flatShading
      />
    </mesh>
  )
}

// ====== TERRAIN FEATURES ======

function TerrainFeatures({ terrain }: { terrain: TerrainType }) {
  const config = TERRAIN_CONFIGS[terrain]

  const features = useMemo(() => {
    const items: { pos: [number, number, number]; scale: number; type: string }[] = []
    const count = terrain === 'jungle' || terrain === 'forest' ? 45 : terrain === 'urban' ? 25 : 18

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 60
      const z = (Math.random() - 0.5) * 60
      // Keep features away from the battle center area
      if (Math.abs(x) < 12 && Math.abs(z) < 10) continue
      const y = getTerrainHeight(x, z, config.heightVariation)
      items.push({
        pos: [x, y, z],
        scale: 0.7 + Math.random() * 1.8,
        type: config.features,
      })
    }
    return items
  }, [terrain, config])

  return (
    <group>
      {features.map((f, i) => {
        if (f.type === 'trees' || f.type === 'dense_trees') {
          return (
            <group key={i} position={f.pos}>
              <mesh position={[0, f.scale * 0.8, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.15, f.scale * 1.5, 6]} />
                <meshStandardMaterial color="#5c3a1a" roughness={0.9} />
              </mesh>
              <mesh position={[0, f.scale * 1.8, 0]} castShadow>
                <coneGeometry args={[f.scale * 0.6, f.scale * 1.4, 6]} />
                <meshStandardMaterial color={f.type === 'dense_trees' ? '#0a3a0a' : '#1a5a1a'} roughness={0.8} />
              </mesh>
            </group>
          )
        }
        if (f.type === 'rocks') {
          return (
            <mesh key={i} position={f.pos} castShadow rotation={[Math.random() * 0.5, Math.random() * Math.PI, 0]}>
              <dodecahedronGeometry args={[f.scale * 0.6, 0]} />
              <meshStandardMaterial color="#7a7a7a" roughness={1} flatShading />
            </mesh>
          )
        }
        if (f.type === 'buildings') {
          const height = f.scale * 2.5 + Math.random() * 4
          return (
            <mesh key={i} position={[f.pos[0], f.pos[1] + height / 2, f.pos[2]]} castShadow>
              <boxGeometry args={[1.8 + Math.random(), height, 1.8 + Math.random()]} />
              <meshStandardMaterial color={`hsl(220, 5%, ${25 + Math.random() * 20}%)`} roughness={0.7} />
            </mesh>
          )
        }
        if (f.type === 'dunes') {
          return (
            <mesh key={i} position={f.pos} castShadow>
              <sphereGeometry args={[f.scale * 1.8, 8, 6]} />
              <meshStandardMaterial color="#d4b84f" roughness={1} flatShading />
            </mesh>
          )
        }
        if (f.type === 'snow') {
          return (
            <mesh key={i} position={f.pos} castShadow>
              <sphereGeometry args={[f.scale * 1.0, 6, 4]} />
              <meshStandardMaterial color="#f0f0f8" roughness={0.5} flatShading />
            </mesh>
          )
        }
        return (
          <mesh key={i} position={f.pos}>
            <boxGeometry args={[0.15, f.scale * 0.4, 0.15]} />
            <meshStandardMaterial color={f.type === 'beach' ? '#e8d8a0' : '#3a6a3a'} />
          </mesh>
        )
      })}
    </group>
  )
}

// ====== SOLDIER FIGURE (SCALED UP 3x) ======

function Soldier({
  position,
  color,
  accentColor,
  side,
  divisionType,
  isMoving,
  animOffset,
}: {
  position: [number, number, number]
  color: string
  accentColor: string
  side: 'attacker' | 'defender'
  divisionType: DivisionType
  isMoving: boolean
  animOffset: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(animOffset)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    timeRef.current += delta
    const bobAmount = isMoving ? 0.15 : 0.05
    groupRef.current.position.y = position[1] + Math.sin(timeRef.current * 3 + animOffset) * bobAmount
    if (isMoving) {
      groupRef.current.rotation.z = Math.sin(timeRef.current * 5 + animOffset) * 0.06
    }
  })

  const isVehicle = divisionType === 'jeep' || divisionType === 'tank' || divisionType === 'warship'
  const isAir = false
  const isArtillery = false

  if (isAir) {
    return (
      <group ref={groupRef} position={position}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.3, 2.0]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[3.0, 0.1, 0.6]} />
          <meshStandardMaterial color={accentColor} metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, -0.9]} castShadow>
          <boxGeometry args={[1.0, 0.5, 0.1]} />
          <meshStandardMaterial color={accentColor} />
        </mesh>
      </group>
    )
  }

  if (isVehicle) {
    return (
      <group ref={groupRef} position={position}>
        <mesh castShadow>
          <boxGeometry args={[1.6, 0.6, 2.4]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.0, 0.5, 1.0]} />
          <meshStandardMaterial color={accentColor} roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.55, 1.0]} castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.3, 6]} />
          <meshStandardMaterial color="#333" metalness={0.6} />
        </mesh>
        <mesh position={[-0.75, -0.2, 0]}>
          <boxGeometry args={[0.2, 0.3, 2.2]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
        </mesh>
        <mesh position={[0.75, -0.2, 0]}>
          <boxGeometry args={[0.2, 0.3, 2.2]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
        </mesh>
      </group>
    )
  }

  if (isArtillery) {
    return (
      <group ref={groupRef} position={position}>
        <mesh castShadow>
          <boxGeometry args={[1.0, 0.4, 1.5]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.5, 0.6]} castShadow rotation={[-0.3, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.15, 1.8, 8]} />
          <meshStandardMaterial color="#444" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.2, 0.7, 0.12]} />
          <meshStandardMaterial color={accentColor} roughness={0.6} />
        </mesh>
      </group>
    )
  }

  // Infantry / Special Forces — humanoid figure (scaled up)
  const faceDir = side === 'attacker' ? 0 : Math.PI
  return (
    <group ref={groupRef} position={position} rotation={[0, faceDir, 0]}>
      {/* Body */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.55, 0.8, 0.35]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshStandardMaterial color="#d4a574" roughness={0.7} />
      </mesh>
      {/* Helmet */}
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={accentColor} roughness={0.6} />
      </mesh>
      {/* Left Leg */}
      <mesh position={[-0.14, 0.3, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.25]} />
        <meshStandardMaterial color={accentColor} roughness={0.9} />
      </mesh>
      {/* Right Leg */}
      <mesh position={[0.14, 0.3, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.25]} />
        <meshStandardMaterial color={accentColor} roughness={0.9} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.4, 0.9, 0]} castShadow>
        <boxGeometry args={[0.15, 0.7, 0.2]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0.4, 0.9, 0]} castShadow>
        <boxGeometry args={[0.15, 0.7, 0.2]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Rifle */}
      <mesh position={[0.45, 0.85, 0.25]} castShadow rotation={[0.3, 0, 0.1]}>
        <boxGeometry args={[0.06, 0.06, 1.0]} />
        <meshStandardMaterial color="#333" metalness={0.4} />
      </mesh>
    </group>
  )
}

// ====== MUZZLE FLASH (fixed: no setTimeout, pure useFrame) ======

function MuzzleFlash({ position, active }: { position: [number, number, number]; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const timerRef = useRef(0)
  const [visible, setVisible] = useState(false)

  useFrame((_: any, delta: number) => {
    if (!active) { setVisible(false); return }
    timerRef.current += delta
    if (timerRef.current > 0.3 + Math.random() * 0.5) {
      setVisible(true)
      timerRef.current = -0.08 // show for ~80ms
    } else if (timerRef.current > 0) {
      setVisible(false)
    }
  })

  if (!visible) return null

  return (
    <mesh ref={ref} position={[position[0] + (Math.random() - 0.5) * 0.5, position[1] + 1.0, position[2] + 0.5]}>
      <sphereGeometry args={[0.25, 6, 4]} />
      <meshBasicMaterial color="#ff8800" transparent opacity={0.9} />
    </mesh>
  )
}

// ====== EXPLOSION PARTICLE ======

function Explosion({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null)
  const scaleRef = useRef(0.1)
  const opacityRef = useRef(1)
  const [dead, setDead] = useState(false)

  useFrame((_: any, delta: number) => {
    scaleRef.current = Math.min(3, scaleRef.current + delta * 5)
    opacityRef.current = Math.max(0, opacityRef.current - delta * 2)
    if (ref.current) {
      ref.current.scale.setScalar(scaleRef.current)
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = opacityRef.current
    }
    if (opacityRef.current <= 0) setDead(true)
  })

  if (dead) return null

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.6, 8, 6]} />
      <meshBasicMaterial color="#ff4400" transparent opacity={1} />
    </mesh>
  )
}

// ====== SMOKE TRAIL ======

function SmokeTrail({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null)
  const opacityRef = useRef(0.4)
  const [dead, setDead] = useState(false)

  useFrame((_: any, delta: number) => {
    opacityRef.current = Math.max(0, opacityRef.current - delta * 0.8)
    if (ref.current) {
      ref.current.position.y += delta * 1.5
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = opacityRef.current
    }
    if (opacityRef.current <= 0) setDead(true)
  })

  if (dead) return null

  return (
    <mesh ref={ref} position={[position[0], position[1] + 1, position[2]]}>
      <sphereGeometry args={[0.4, 6, 4]} />
      <meshBasicMaterial color="#555555" transparent opacity={0.4} />
    </mesh>
  )
}

// ====== ARMY FORMATION (with terrain height sampling) ======

function ArmyFormation({
  divisions,
  side,
  isEngaged,
  heightVariation,
}: {
  divisions: { type: DivisionType; name: string; health: number; maxHealth: number }[]
  side: 'attacker' | 'defender'
  isEngaged: boolean
  heightVariation: number
}) {
  const xBase = side === 'attacker' ? -10 : 10

  const units = useMemo(() => {
    const result: {
      pos: [number, number, number]
      type: DivisionType
      animOffset: number
    }[] = []

    divisions.forEach((div, divIndex) => {
      const template = DIVISION_TEMPLATES[div.type]
      const isAir = false
      const strengthRatio = div.health / div.maxHealth
      const soldierCount = Math.max(2, Math.ceil(strengthRatio * 5))

      for (let s = 0; s < soldierCount; s++) {
        const row = Math.floor(divIndex / 3)
        const col = divIndex % 3
        const xOffset = xBase + col * 3.5 * (side === 'attacker' ? 1 : -1)
        const zOffset = (row - divisions.length / 6) * 4 + (s - soldierCount / 2) * 1.2
        const xFinal = xOffset + (Math.random() - 0.5) * 0.8
        const zFinal = zOffset + (Math.random() - 0.5) * 0.5

        // Sample terrain height at this position
        const terrainY = isAir ? 6 + Math.random() * 3 : getTerrainHeight(xFinal, zFinal, heightVariation)

        result.push({
          pos: [xFinal, terrainY, zFinal],
          type: div.type,
          animOffset: divIndex * 0.7 + s * 0.3,
        })
      }
    })
    return result
  }, [divisions, side, xBase, heightVariation])

  return (
    <group>
      {units.map((unit, i) => {
        const colors = UNIT_COLORS[unit.type]
        const sideColor = side === 'attacker'
          ? { body: '#3a6a9a', accent: '#1a4a8a' }
          : { body: '#9a3a3a', accent: '#8a1a1a' }

        return (
          <React.Fragment key={i}>
            <Soldier
              position={unit.pos}
              color={sideColor.body}
              accentColor={sideColor.accent}
              side={side}
              divisionType={unit.type}
              isMoving={isEngaged}
              animOffset={unit.animOffset}
            />
            {isEngaged && (
              <MuzzleFlash position={unit.pos} active={isEngaged} />
            )}
          </React.Fragment>
        )
      })}
    </group>
  )
}

// ====== BATTLE FLAG ======

function BattleFlag({ position, color, label }: { position: [number, number, number]; color: string; label: string }) {
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.z = Math.sin(Date.now() * 0.002) * 0.05
  })

  return (
    <group ref={ref} position={position}>
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, 4, 6]} />
        <meshStandardMaterial color="#888" metalness={0.5} />
      </mesh>
      <mesh position={[0.6, 1.6, 0]}>
        <planeGeometry args={[1.2, 0.7]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0.6, 1.6, 0.02]}
        fontSize={0.22}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}

// ====== COMBAT EFFECTS ======

function CombatEffects({ active }: { active: boolean }) {
  const [explosions, setExplosions] = useState<[number, number, number][]>([])
  const [smokes, setSmokes] = useState<[number, number, number][]>([])

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      if (Math.random() < 0.4) {
        const x = (Math.random() - 0.5) * 8
        const z = (Math.random() - 0.5) * 10
        setExplosions(prev => [
          ...prev.slice(-6),
          [x, 0.8 + Math.random() * 0.5, z] as [number, number, number],
        ])
      }
      if (Math.random() < 0.3) {
        const x = (Math.random() - 0.5) * 10
        const z = (Math.random() - 0.5) * 12
        setSmokes(prev => [
          ...prev.slice(-4),
          [x, 0.5, z] as [number, number, number],
        ])
      }
    }, 500)
    return () => clearInterval(interval)
  }, [active])

  return (
    <group>
      {explosions.map((pos, i) => (
        <Explosion key={`exp-${i}-${pos[0].toFixed(2)}`} position={pos} />
      ))}
      {smokes.map((pos, i) => (
        <SmokeTrail key={`smoke-${i}-${pos[0].toFixed(2)}`} position={pos} />
      ))}
    </group>
  )
}

// ====== CAMERA CONTROLLER ======

function CameraController() {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(0, 14, 22)
    camera.lookAt(0, 0, 0)
  }, [camera])

  return <OrbitControls
    enablePan={true}
    enableZoom={true}
    maxPolarAngle={Math.PI / 2.2}
    minDistance={5}
    maxDistance={40}
    target={[0, 0, 0]}
  />
}

// ====== MAIN COMPONENT ======

interface BattleScene3DProps {
  battle: { id: string } // Just pass the battle ID; we read live state inside
  attackerDivisions: { type: DivisionType; name: string; health: number; maxHealth: number }[]
  defenderDivisions: { type: DivisionType; name: string; health: number; maxHealth: number }[]
  onClose: () => void
}

export default function BattleScene3D({ battle: battleRef, attackerDivisions, defenderDivisions, onClose }: BattleScene3DProps) {
  // Read live battle state from store so it updates each tick
  const battle = useBattleStore(state => state.battles[battleRef.id])

  if (!battle) {
    return (
      <div className="battle-scene-3d" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#e2e8f0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚔️</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>Battle ended</div>
          <button className="battle-scene-hud__close" onClick={onClose} style={{ marginTop: '16px' }}>✕ CLOSE</button>
        </div>
      </div>
    )
  }

  const terrain: TerrainType = 'plains'
  const config = TERRAIN_CONFIGS[terrain]
  const isEngaged = battle.status === 'active'

  return (
    <div className="battle-scene-3d">
      {/* Top HUD overlay */}
      <div className="battle-scene-hud">
        <div className="battle-scene-hud__left">
          <div className="battle-scene-hud__flag battle-scene-hud__flag--atk">
            {battle.attackerId}
          </div>
          <div className="battle-scene-hud__info">
            <div className="battle-scene-hud__label">ATTACKER</div>
            <div className="battle-scene-hud__divs">{attackerDivisions.length} divisions</div>
          </div>
        </div>

        <div className="battle-scene-hud__center">
          <div className="battle-scene-hud__terrain">
            ⚔️ {battle.regionName}
          </div>
          <div className="battle-scene-hud__modifiers">
            {battle.attacker.engagedDivisionIds.length} vs {battle.defender.engagedDivisionIds.length} divs
          </div>
          <div className="battle-scene-hud__tick">
            Tick {battle.ticksElapsed} • {battle.status.toUpperCase()}
          </div>
        </div>

        <div className="battle-scene-hud__right">
          <div className="battle-scene-hud__info" style={{ textAlign: 'right' }}>
            <div className="battle-scene-hud__label">DEFENDER</div>
            <div className="battle-scene-hud__divs">{defenderDivisions.length} divisions</div>
          </div>
          <div className="battle-scene-hud__flag battle-scene-hud__flag--def">
            {battle.defenderId}
          </div>
        </div>

        <button className="battle-scene-hud__close" onClick={onClose}>✕ CLOSE 3D VIEW</button>
      </div>

      {/* Stats bar */}
      <div className="battle-scene-stats">
        <div className="battle-scene-stat">
          <span>📊 DMG Dealt</span>
          <span className="battle-scene-stat__val">{battle.attacker.damageDealt}</span>
        </div>
        <div className="battle-scene-stat">
          <span>💀 Lost</span>
          <span className="battle-scene-stat__val">{battle.attacker.manpowerLost}</span>
        </div>
        <div className="battle-scene-stat battle-scene-stat--vs">VS</div>
        <div className="battle-scene-stat">
          <span>📊 DMG Dealt</span>
          <span className="battle-scene-stat__val">{battle.defender.damageDealt}</span>
        </div>
        <div className="battle-scene-stat">
          <span>💀 Lost</span>
          <span className="battle-scene-stat__val">{battle.defender.manpowerLost}</span>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 14, 22], fov: 50 }}
        style={{ background: config.fogColor }}
      >
        <CameraController />

        {/* Lighting */}
        <ambientLight intensity={config.ambientIntensity} />
        <directionalLight
          position={[15, 25, 10]}
          intensity={1.4}
          color={config.directionalColor}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={60}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
        <hemisphereLight
          color={config.skyColor}
          groundColor={config.groundColor2}
          intensity={0.4}
        />

        {/* Fog */}
        <fog attach="fog" args={[config.fogColor, 20, 60]} />

        {/* Stars for ambiance */}
        {(terrain as string) !== 'arctic' && (terrain as string) !== 'jungle' && (
          <Stars radius={100} depth={50} count={300} factor={2} />
        )}

        {/* Terrain */}
        <TerrainGround terrain={terrain} />
        <TerrainFeatures terrain={terrain} />

        {/* Battle Flags */}
        <BattleFlag
          position={[-14, getTerrainHeight(-14, 0, config.heightVariation) + 2, 0]}
          color="#3b82f6"
          label={battle.attackerId}
        />
        <BattleFlag
          position={[14, getTerrainHeight(14, 0, config.heightVariation) + 2, 0]}
          color="#ef4444"
          label={battle.defenderId}
        />

        {/* Armies */}
        <ArmyFormation
          divisions={attackerDivisions}
          side="attacker"
          isEngaged={isEngaged}
          heightVariation={config.heightVariation}
        />
        <ArmyFormation
          divisions={defenderDivisions}
          side="defender"
          isEngaged={isEngaged}
          heightVariation={config.heightVariation}
        />

        {/* Combat Effects */}
        <CombatEffects active={isEngaged} />

        {/* Ground grid */}
        <gridHelper args={[80, 40, '#333333', '#1a1a1a']} position={[0, 0.02, 0]} />
      </Canvas>
    </div>
  )
}
