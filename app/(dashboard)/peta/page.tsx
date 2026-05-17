"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type VehicleType = "car" | "bus" | "motorcycle";
type DriverState = "moving" | "parking_detected" | "violating";
type ScenarioId  = 1 | 2 | 3;

interface ViolationLog {
  id        : number;
  scenario  : ScenarioId;
  plate     : string;
  type      : string;
  timestamp : string;
  confidence: number;
  icon      : string;
}

interface Vehicle {
  mesh      : THREE.Group;
  bodyMesh  : THREE.Mesh;
  zoneMesh  : THREE.Mesh | null;   // ref to this scenario's zone plane
  type      : VehicleType;
  isViolator: boolean;
  state     : DriverState;
  stopTimer : number;
  color     : THREE.Color;
  speed     : number;
  direction : 1 | -1;
  initialX  : number;
  initialZ  : number;
  kmh       : number;
}

interface ScenarioCfg {
  id          : ScenarioId;
  label       : string;
  sub         : string;
  icon        : string;
  accent      : string;
  violatorType: VehicleType;
  violatorHex : number;
  plate       : string;
  violation   : string;
  zone        : { x: number; z: number };
  zoneHex     : number;
  zoneW       : number;
  zoneD       : number;
  cageW       : number;
  cageH       : number;
  cageD       : number;
  cageY       : number;
  camPos      : { x: number; y: number; z: number };
  camTarget   : { x: number; y: number; z: number };
  desc        : string;
  laneDesc    : string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const CITY_SIZE         = 50;
const VIOLATION_TIMEOUT = 10;

const SCENARIOS: ScenarioCfg[] = [
  {
    id: 1, label: "SCN-01", sub: "Jalur Sepeda", icon: "🚲", accent: "emerald",
    violatorType: "car",       violatorHex: 0x10b981,
    plate: "B 4518 PUI",       violation: "Bicycle Lane Obstruction",
    zone: { x: 4.2, z: -8 },  zoneHex: 0x10b981,
    zoneW: 1.4, zoneD: 6.0,   cageW: 2.0, cageH: 1.8, cageD: 4.5, cageY: 0.9,
    camPos:    { x: 14, y: 10, z: 10 },
    camTarget: { x: 4,  y: 0,  z: -6 },
    desc: "Kendaraan berhenti di jalur sepeda lebih dari 10 detik",
    laneDesc: "Jalur eksklusif pesepeda — dilarang kendaraan bermotor",
  },
  {
    id: 2, label: "SCN-02", sub: "Jalur Busway", icon: "🚌", accent: "rose",
    violatorType: "car",       violatorHex: 0xf43f5e,
    plate: "D 2277 KBA",       violation: "Busway Lane Intrusion",
    zone: { x: -2.0, z: -8 }, zoneHex: 0xf43f5e,
    zoneW: 2.4, zoneD: 6.0,   cageW: 2.4, cageH: 1.8, cageD: 4.5, cageY: 0.9,
    camPos:    { x: -14, y: 10, z: 10 },
    camTarget: { x: -2,  y: 0,  z: -6 },
    desc: "Kendaraan memasuki & berhenti di jalur busway lebih dari 10 detik",
    laneDesc: "Jalur eksklusif TransJakarta — sanksi tilang otomatis",
  },
  {
    id: 3, label: "SCN-03", sub: "Trotoar", icon: "🛵", accent: "amber",
    violatorType: "motorcycle",  violatorHex: 0xf59e0b,
    plate: "B 9901 ZXK",         violation: "Sidewalk Violation",
    zone: { x: 7.5, z: -8 },    zoneHex: 0xf59e0b,
    zoneW: 2.0, zoneD: 6.0,     cageW: 1.8, cageH: 1.4, cageD: 4.0, cageY: 0.7,
    camPos:    { x: 18, y: 10, z: 10 },
    camTarget: { x: 7.5, y: 0,  z: -6 },
    desc: "Motor naik & berhenti di trotoar lebih dari 10 detik",
    laneDesc: "Area pejalan kaki — kendaraan dilarang masuk",
  },
];

const AC: Record<string, {
  text: string; bg: string; border: string;
  badge: string; bar: string; glow: string; dot: string; ring: string;
}> = {
  emerald: {
    text: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-500/40",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    bar: "bg-emerald-500", glow: "shadow-[0_0_32px_rgba(16,185,129,0.4)]",
    dot: "bg-emerald-500", ring: "ring-emerald-500/30",
  },
  rose: {
    text: "text-rose-400", bg: "bg-rose-900/20", border: "border-rose-500/40",
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    bar: "bg-rose-500", glow: "shadow-[0_0_32px_rgba(244,63,94,0.4)]",
    dot: "bg-rose-500", ring: "ring-rose-500/30",
  },
  amber: {
    text: "text-amber-400", bg: "bg-amber-900/20", border: "border-amber-500/40",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    bar: "bg-amber-500", glow: "shadow-[0_0_32px_rgba(245,158,11,0.4)]",
    dot: "bg-amber-500", ring: "ring-amber-500/30",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// THREE.JS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function buildTrafficLight(x: number, z: number, ry: number) {
  const spheres: THREE.Mesh[] = [];
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 4.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 })
  );
  pole.position.y = 2.1; g.add(pole);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 1.05, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x0f172a })
  );
  box.position.set(0, 3.65, 0); g.add(box);
  [0xff2222, 0xffaa00, 0x00ee55].forEach((c, i) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 16),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.12 })
    );
    m.position.set(0, 3.98 - i * 0.31, 0.15);
    g.add(m); spheres.push(m);
  });
  g.rotation.y = ry; g.position.set(x, 0, z);
  return { group: g, spheres };
}

function buildBuilding(w: number, h: number, d: number, x: number, z: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.2, roughness: 0.6 })
  );
  body.position.y = h / 2; body.castShadow = true; g.add(body);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.98, h * 0.78, d * 0.9),
    new THREE.MeshStandardMaterial({
      color: 0x0c4a6e, emissive: 0x0369a1, emissiveIntensity: 0.35,
      transparent: true, opacity: 0.45, metalness: 1, roughness: 0,
    })
  );
  glass.position.y = h / 2; g.add(glass);
  const ledge = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.25, 0.12, d + 0.25),
    new THREE.MeshStandardMaterial({ color: 0x334155 })
  );
  ledge.position.y = h + 0.06; g.add(ledge);
  if (Math.random() > 0.45) {
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x64748b })
    );
    ant.position.y = h + 0.88; g.add(ant);
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 2.5 })
    );
    led.position.y = h + 1.7; g.add(led);
  }
  g.position.set(x, 0, z); return g;
}

function buildVehicle(color: THREE.Color, type: VehicleType) {
  const g = new THREE.Group();
  let w = 1.6, h = 0.55, d = 0.85;
  if (type === "bus")        { w = 3.6; h = 1.2;  d = 1.1;  }
  if (type === "motorcycle") { w = 1.0; h = 0.42; d = 0.42; }

  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.y = h / 2 + 0.05; body.castShadow = true; g.add(body);

  if (type === "car" || type === "bus") {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.58, h * 0.4, d * 1.01),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, transparent: true, opacity: 0.88 })
    );
    glass.position.set(w * 0.09, h * 0.73, 0); g.add(glass);
    [-1, 1].forEach(s => {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5 }));
      hl.position.set(-(w / 2 + 0.02), h * 0.48, s * d * 0.28); g.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.8 }));
      tl.position.set(w / 2 + 0.01, h * 0.48, s * d * 0.28); g.add(tl);
    });
  } else {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 }));
    bar.rotation.z = Math.PI / 2; bar.position.set(0.36, h + 0.05, 0); g.add(bar);
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0c4a6e, transparent: true, opacity: 0.7 }));
    ws.position.set(0.32, h + 0.14, 0); g.add(ws);
    [-0.4, 0.4].forEach(xOff => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 16),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3 }));
      wheel.rotation.z = Math.PI / 2; wheel.position.set(xOff, 0.17, 0); g.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 }));
      rim.rotation.z = Math.PI / 2; rim.position.set(xOff, 0.17, 0); g.add(rim);
    });
  }

  const pt = new THREE.PointLight(color.getHex(), 2.0, 4);
  pt.position.y = 0.04; g.add(pt);

  return { mesh: g, bodyMesh: body };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SandboxSmartCity() {
  const mountRef = useRef<HTMLDivElement>(null);

  // Three.js refs
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const clockRef     = useRef(new THREE.Clock());
  const controlsRef  = useRef<OrbitControls | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);

  // Scene object management
  const scenObjsRef  = useRef<THREE.Object3D[]>([]);
  const tlSpheresRef = useRef<THREE.Mesh[]>([]);

  // Vehicle refs
  const normalCarsRef = useRef<Vehicle[]>([]);
  const violatorRef   = useRef<Vehicle | null>(null);
  const cageRef       = useRef<THREE.LineSegments | null>(null);

  // Camera lerp targets
  const camPosTargetRef    = useRef(new THREE.Vector3(20, 14, 22));
  const camLookTargetRef   = useRef(new THREE.Vector3(0, 0, -5));
  const camIsMovingRef     = useRef(false);

  // Scenario switching
  const desiredScenRef = useRef<ScenarioId>(1);
  const currentScenRef = useRef<ScenarioId>(1);
  const rebuildFlagRef = useRef(false);

  // ── React UI state ────────────────────────────────────────────────────────
  const [uiScenario,    setUiScenario]    = useState<ScenarioId>(1);
  const [driverState,   setDriverState]   = useState<DriverState>("moving");
  const [countdown,     setCountdown]     = useState(VIOLATION_TIMEOUT);
  const [kmh,           setKmh]           = useState(54);
  const [violatorZ,     setViolatorZ]     = useState(CITY_SIZE - 2); // for radar tracking
  const [fps,           setFps]           = useState(0);
  const [clock12,       setClock12]       = useState("");
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Violation log (persistent history)
  const [violationLog,  setViolationLog]  = useState<ViolationLog[]>([]);
  const [showLog,       setShowLog]       = useState(false);
  const logIdRef = useRef(0);

  // Per-scenario counters (persistent)
  const countersRef = useRef<Record<ScenarioId, number>>({ 1: 0, 2: 0, 3: 0 });
  const [countersUi, setCountersUi] = useState<Record<ScenarioId, number>>({ 1: 0, 2: 0, 3: 0 });

  // New violation flash (for DB sync highlight)
  const [syncFlash, setSyncFlash] = useState<ScenarioId | null>(null);

  // Alert state
  const [alert, setAlert] = useState<{ plate: string; type: string; confidence: number } | null>(null);
  const [alertTimestamp, setAlertTimestamp] = useState("");

  // ── External webhook (Supabase / Python AI backend) ──────────────────────
  const handleExternalViolation = useCallback((payload: any) => {
    const scen = currentScenRef.current;
    const cfg  = SCENARIOS[scen - 1];
    const ts   = new Date().toLocaleTimeString("id-ID", { hour12: false });
    countersRef.current[scen]++;
    setCountersUi({ ...countersRef.current });
    setSyncFlash(scen);
    setTimeout(() => setSyncFlash(null), 1200);
    setAlertTimestamp(ts);
    setAlert({
      plate:      payload.license_plate ?? cfg.plate,
      type:       payload.type          ?? cfg.violation,
      confidence: payload.confidence    ?? 97,
    });
    logIdRef.current++;
    setViolationLog(prev => [{
      id: logIdRef.current, scenario: scen,
      plate: payload.license_plate ?? cfg.plate,
      type: payload.type ?? cfg.violation,
      timestamp: ts, confidence: payload.confidence ?? 97,
      icon: cfg.icon,
    }, ...prev].slice(0, 20));
    if (violatorRef.current) violatorRef.current.state = "violating";
    if (cageRef.current) cageRef.current.visible = true;
  }, []);
  // useRealtimeViolations(handleExternalViolation);

  // Clock
  useEffect(() => {
    const t = () => setClock12(new Date().toLocaleTimeString("id-ID", { hour12: false }));
    t(); const id = setInterval(t, 1000); return () => clearInterval(id);
  }, []);

  // Outside click → close menu
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const el = document.getElementById("scen-menu");
      if (el && !el.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Scenario switch ───────────────────────────────────────────────────────
  const switchScenario = useCallback((id: ScenarioId) => {
    if (id === desiredScenRef.current) { setMenuOpen(false); return; }
    setMenuOpen(false);
    setTransitioning(true);
    setAlert(null);
    setCountdown(VIOLATION_TIMEOUT);
    setDriverState("moving");
    setKmh(54);
    desiredScenRef.current = id;
    rebuildFlagRef.current  = true;
    setUiScenario(id);
    // Trigger camera lerp
    const cfg = SCENARIOS[id - 1];
    camPosTargetRef.current.set(cfg.camPos.x, cfg.camPos.y, cfg.camPos.z);
    camLookTargetRef.current.set(cfg.camTarget.x, cfg.camTarget.y, cfg.camTarget.z);
    camIsMovingRef.current = true;
    setTimeout(() => { setTransitioning(false); camIsMovingRef.current = false; }, 800);
  }, []);

  // ── Main Three.js effect ──────────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current!;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled    = true;
    renderer.shadowMap.type       = THREE.PCFSoftShadowMap;
    renderer.toneMapping          = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure  = 1.05;
    renderer.setClearColor(0x050d1a);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050d1a, 0.016);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40,
      container.clientWidth / container.clientHeight, 0.1, 300);
    camera.position.set(20, 14, 22);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance   = 6;
    controls.maxDistance   = 90;
    controls.target.set(0, 0, -5);
    controlsRef.current = controls;

    // Lights
    scene.add(new THREE.AmbientLight(0x1a2744, 2.8));
    const sun = new THREE.DirectionalLight(0x7ec8e3, 1.1);
    sun.position.set(25, 40, 20); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -40; sun.shadow.camera.right =  40;
    sun.shadow.camera.top  =  40; sun.shadow.camera.bottom = -40;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x112244, 0x050d1a, 1.1));

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_SIZE * 2, CITY_SIZE * 2),
      new THREE.MeshStandardMaterial({ color: 0x0c1526, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // Roads
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a2535, roughness: 0.88 });
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE * 2, 10), roadMat);
    roadH.rotation.x = -Math.PI / 2; roadH.position.y = 0.01; scene.add(roadH);
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(10, CITY_SIZE * 2), roadMat);
    roadV.rotation.x = -Math.PI / 2; roadV.position.y = 0.01; scene.add(roadV);

    // Road dashes
    for (let z = -CITY_SIZE; z < CITY_SIZE; z += 4.5) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.2),
        new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfef9c3, emissiveIntensity: 0.3 }));
      dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.02, z); scene.add(dash);
    }

    // Busway (dark red)
    const busway = new THREE.Mesh(new THREE.PlaneGeometry(2.4, CITY_SIZE * 2),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0x991b1b, emissiveIntensity: 0.15 }));
    busway.rotation.x = -Math.PI / 2; busway.position.set(-2.0, 0.02, 0); scene.add(busway);
    for (let z = -CITY_SIZE; z < CITY_SIZE; z += 6) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff4444, emissiveIntensity: 0.5 }));
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(-2.0, 0.025, z); scene.add(stripe);
    }

    // Bike lane (dark green)
    const bikeLane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, CITY_SIZE * 2),
      new THREE.MeshStandardMaterial({ color: 0x052e16, emissive: 0x065f46, emissiveIntensity: 0.18 }));
    bikeLane.rotation.x = -Math.PI / 2; bikeLane.position.set(4.2, 0.02, 0); scene.add(bikeLane);
    for (let z = -CITY_SIZE + 4; z < CITY_SIZE; z += 8) {
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.4, transparent: true, opacity: 0.6 }));
      marker.rotation.x = -Math.PI / 2; marker.position.set(4.2, 0.03, z); scene.add(marker);
    }

    // Sidewalk
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(2.2, CITY_SIZE * 2),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.92 }));
    sw.rotation.x = -Math.PI / 2; sw.position.set(7.5, 0.015, 0); scene.add(sw);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, CITY_SIZE * 2),
      new THREE.MeshStandardMaterial({ color: 0x475569 }));
    curb.position.set(6.42, 0.045, 0); scene.add(curb);
    for (let z = -CITY_SIZE; z < CITY_SIZE; z += 1.5) {
      for (let xi = 0; xi < 2; xi++) {
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4),
          new THREE.MeshStandardMaterial({ color: xi % 2 ? 0x3d5166 : 0x2e4055, roughness: 0.95 }));
        tile.rotation.x = -Math.PI / 2; tile.position.set(6.8 + xi * 1.1, 0.02, z); scene.add(tile);
      }
    }

    // Buildings
    const rng = (a: number, b: number) => a + Math.random() * (b - a);
    for (let z = -CITY_SIZE; z < CITY_SIZE; z += 11) {
      if (Math.abs(z) < 9) continue;
      scene.add(buildBuilding(rng(4, 7), rng(10, 24), rng(5, 8), 11, z));
      scene.add(buildBuilding(rng(4, 7), rng(10, 24), rng(5, 8), -11, z));
    }

    // Traffic lights
    tlSpheresRef.current = [];
    const tl1 = buildTrafficLight(5.5, 5.5, Math.PI);
    const tl2 = buildTrafficLight(-5.5, -5.5, 0);
    scene.add(tl1.group); scene.add(tl2.group);
    tlSpheresRef.current.push(...tl1.spheres, ...tl2.spheres);

    // Street lamps
    for (let z = -CITY_SIZE + 8; z < CITY_SIZE; z += 14) {
      [6.4, -6.4].forEach(x => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 5.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }));
        pole.position.set(x, 2.6, z); scene.add(pole);
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfef9c3, emissiveIntensity: 4 }));
        globe.position.set(x, 5.3, z); scene.add(globe);
        const pt = new THREE.PointLight(0xfef3c7, 10, 14, 2);
        pt.position.set(x, 5.2, z); scene.add(pt);
      });
    }

    // ── Normal vehicles ───────────────────────────────────────────────────
    normalCarsRef.current = [];

    function spawnNormal(color: number, type: VehicleType, x: number, startZ: number, dir: 1 | -1, spd: number) {
      const c = new THREE.Color(color);
      const { mesh, bodyMesh } = buildVehicle(c, type);
      mesh.position.set(x, 0.05, startZ); mesh.rotation.y = Math.PI / 2;
      scene.add(mesh);
      normalCarsRef.current.push({
        mesh, bodyMesh, zoneMesh: null, type, isViolator: false,
        state: "moving", stopTimer: 0, color: c.clone(),
        speed: spd, direction: dir, initialX: x, initialZ: startZ, kmh: Math.round(spd * 600),
      });
    }

    spawnNormal(0xd97706, "bus",  -2.0,  -CITY_SIZE,      1,  0.062);
    spawnNormal(0x6366f1, "car",   1.8,   CITY_SIZE,      -1,  0.100);
    spawnNormal(0x38bdf8, "car",  -1.5,   CITY_SIZE * 0.6, -1, 0.084);
    spawnNormal(0xa855f7, "car",   2.0,  -CITY_SIZE * 0.4,  1, 0.092);

    // ── Build scenario-specific 3D objects ────────────────────────────────
    function buildScenario(id: ScenarioId) {
      // Dispose old objects properly
      scenObjsRef.current.forEach(o => {
        scene.remove(o);
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const m = mesh.material;
          if (Array.isArray(m)) m.forEach(x => x.dispose());
          else (m as THREE.Material).dispose();
        }
      });
      scenObjsRef.current = [];

      currentScenRef.current = id;
      const cfg = SCENARIOS[id - 1];

      // Detection zone plane (we keep a direct ref for pulse animation)
      const zoneMat = new THREE.MeshStandardMaterial({
        color: cfg.zoneHex, emissive: cfg.zoneHex,
        emissiveIntensity: 0.7, transparent: true, opacity: 0.38,
      });
      const zonePlane = new THREE.Mesh(new THREE.PlaneGeometry(cfg.zoneW, cfg.zoneD), zoneMat);
      zonePlane.rotation.x = -Math.PI / 2;
      zonePlane.position.set(cfg.zone.x, 0.03, cfg.zone.z);
      scene.add(zonePlane); scenObjsRef.current.push(zonePlane);

      // Zone glow
      const zonePt = new THREE.PointLight(cfg.zoneHex, 6, 7);
      zonePt.position.set(cfg.zone.x, 0.6, cfg.zone.z);
      scene.add(zonePt); scenObjsRef.current.push(zonePt);

      // Sensor posts
      const hw = cfg.cageW / 2 - 0.06, hd = cfg.cageD / 2 - 0.06;
      [[hw, hd], [hw, -hd], [-hw, hd], [-hw, -hd]].forEach(([px, pz]) => {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, cfg.cageH + 0.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 })
        );
        post.position.set(cfg.zone.x + px, cfg.cageY, cfg.zone.z + pz);
        scene.add(post); scenObjsRef.current.push(post);
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
          new THREE.MeshStandardMaterial({ color: cfg.zoneHex, emissive: cfg.zoneHex, emissiveIntensity: 1.8 }));
        led.position.set(cfg.zone.x + px, cfg.cageY + cfg.cageH / 2, cfg.zone.z + pz);
        scene.add(led); scenObjsRef.current.push(led);
      });

      // Cage
      const cage = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(cfg.cageW, cfg.cageH, cfg.cageD)),
        new THREE.LineBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0 })
      );
      cage.position.set(cfg.zone.x, cfg.cageY, cfg.zone.z);
      cage.visible = false;
      scene.add(cage); scenObjsRef.current.push(cage);
      cageRef.current = cage;

      // Violator
      const vColor = new THREE.Color(cfg.violatorHex);
      const { mesh: vMesh, bodyMesh: vBM } = buildVehicle(vColor, cfg.violatorType);
      vMesh.position.set(cfg.zone.x, 0.05, CITY_SIZE - 2);
      vMesh.rotation.y = -Math.PI / 2;
      if (cfg.violatorType === "motorcycle") vMesh.scale.setScalar(1.18);
      scene.add(vMesh); scenObjsRef.current.push(vMesh);

      // Assign zoneMesh ref into violator so animate loop can pulse it
      violatorRef.current = {
        mesh: vMesh, bodyMesh: vBM,
        zoneMesh: zonePlane,         // ← direct ref, no find() needed
        type: cfg.violatorType,
        isViolator: true, state: "moving", stopTimer: 0,
        color: vColor.clone(),
        speed: cfg.violatorType === "motorcycle" ? 0.11 : 0.09,
        direction: -1,
        initialX: cfg.zone.x, initialZ: CITY_SIZE - 2,
        kmh: 54,
      };
    }

    buildScenario(1);

    // ── Animation loop ─────────────────────────────────────────────────────
    let animId: number;
    const clock = clockRef.current;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta   = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Scenario rebuild (safe - inside frame boundary)
      if (rebuildFlagRef.current) {
        rebuildFlagRef.current = false;
        buildScenario(desiredScenRef.current);
      }

      // Smooth camera lerp toward target
      const cam = cameraRef.current!;
      if (camIsMovingRef.current) {
        cam.position.lerp(camPosTargetRef.current as THREE.Vector3, 0.04);
        controlsRef.current!.target.lerp(camLookTargetRef.current as THREE.Vector3, 0.04);
      }

      // Traffic lights
      const phase = Math.floor(elapsed / 3.5) % 3;
      tlSpheresRef.current.forEach((s, i) => {
        (s.material as THREE.MeshStandardMaterial).emissiveIntensity =
          (i % 3 === phase) ? 4.5 : 0.05;
      });

      // Normal vehicles
      normalCarsRef.current.forEach(car => {
        car.mesh.position.z += car.direction * car.speed;
        if (car.direction ===  1 && car.mesh.position.z >  CITY_SIZE) car.mesh.position.z = -CITY_SIZE;
        if (car.direction === -1 && car.mesh.position.z < -CITY_SIZE) car.mesh.position.z =  CITY_SIZE;
      });

      // Violator state machine
      const v   = violatorRef.current;
      const cfg = SCENARIOS[currentScenRef.current - 1];

      if (v) {
        const cage = cageRef.current;

        // ── STATE 1: MOVING ──────────────────────────────────────────────
        if (v.state === "moving") {
          v.mesh.position.z += v.direction * v.speed;
          v.kmh = Math.round(v.speed * 600);
          setKmh(v.kmh);
          setDriverState("moving");
          setViolatorZ(v.mesh.position.z);

          // Reset zone pulse to normal while moving
          if (v.zoneMesh) {
            (v.zoneMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7;
            (v.zoneMesh.material as THREE.MeshStandardMaterial).opacity = 0.38;
          }

          if (v.mesh.position.z <= cfg.zone.z) {
            v.mesh.position.z = cfg.zone.z;
            v.state = "parking_detected";
            v.stopTimer = 0;
          }

        // ── STATE 2: PARKING DETECTED ─────────────────────────────────────
        } else if (v.state === "parking_detected") {
          v.stopTimer += delta;
          v.kmh = 0;
          setKmh(0);
          setDriverState("parking_detected");
          setViolatorZ(v.mesh.position.z);

          const rem = Math.max(0, Math.ceil(VIOLATION_TIMEOUT - v.stopTimer));
          setCountdown(rem);

          // Zone urgency pulse — grows as timer approaches 0
          if (v.zoneMesh) {
            const urgency  = v.stopTimer / VIOLATION_TIMEOUT;
            const pulseSpd = 3 + urgency * 9;            // pulse rate speeds up
            const baseEmi  = 0.7 + urgency * 1.8;
            const pulseEmi = baseEmi * (0.6 + 0.4 * Math.abs(Math.sin(elapsed * pulseSpd)));
            const mat = v.zoneMesh.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = pulseEmi;
            mat.opacity = 0.38 + urgency * 0.3;
          }

          if (v.stopTimer >= VIOLATION_TIMEOUT) {
            v.state = "violating";
            const ts = new Date().toLocaleTimeString("id-ID", { hour12: false });
            countersRef.current[currentScenRef.current]++;
            setCountersUi({ ...countersRef.current });
            setSyncFlash(currentScenRef.current);
            setTimeout(() => setSyncFlash(null), 1400);
            setAlertTimestamp(ts);
            setAlert({ plate: cfg.plate, type: cfg.violation, confidence: 94 + Math.floor(Math.random() * 5) });
            logIdRef.current++;
            setViolationLog(prev => [{
              id: logIdRef.current, scenario: currentScenRef.current,
              plate: cfg.plate, type: cfg.violation, timestamp: ts,
              confidence: 94 + Math.floor(Math.random() * 5), icon: cfg.icon,
            }, ...prev].slice(0, 20));
          }

        // ── STATE 3: VIOLATING ────────────────────────────────────────────
        } else if (v.state === "violating") {
          v.stopTimer += delta;
          setDriverState("violating");
          setViolatorZ(v.mesh.position.z);

          if (cage) {
            cage.visible = true;
            const pulse = 0.4 + Math.abs(Math.sin(elapsed * 10)) * 0.6;
            (cage.material as THREE.LineBasicMaterial).opacity = pulse;
          }
          // Zone stays max intensity
          if (v.zoneMesh) {
            (v.zoneMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
              2.4 + Math.abs(Math.sin(elapsed * 8)) * 0.6;
            (v.zoneMesh.material as THREE.MeshStandardMaterial).opacity = 0.65;
          }
          // Body flicker red
          (v.bodyMesh.material as THREE.MeshStandardMaterial).color.setRGB(
            0.94 * (0.5 + Math.abs(Math.sin(elapsed * 8)) * 0.5) + 0.06, 0.06, 0.06
          );

          // Auto-reset → loop
          if (v.stopTimer > VIOLATION_TIMEOUT + 8) {
            if (cage) cage.visible = false;
            v.state = "moving"; v.stopTimer = 0;
            v.mesh.position.set(v.initialX, 0.05, v.initialZ);
            (v.bodyMesh.material as THREE.MeshStandardMaterial).color.copy(v.color);
            setAlert(null); setCountdown(VIOLATION_TIMEOUT);
            setDriverState("moving"); setKmh(54);
          }
        }
      }

      setFps(Math.round(1 / (delta || 0.016)));
      controlsRef.current!.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      cam.aspect = w / h; cam.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    // workaround: camera used before declaration inside closure
    const cam = camera;
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      normalCarsRef.current = []; scenObjsRef.current = []; tlSpheresRef.current = [];
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  // ── Derived UI ────────────────────────────────────────────────────────────
  const cfg = SCENARIOS[uiScenario - 1];
  const ac  = AC[cfg.accent];

  const stateLabel =
    driverState === "violating"        ? "VIOLATING"       :
    driverState === "parking_detected" ? "DETECTING STOP"  : "MOVING";

  const stateColor =
    driverState === "violating"        ? "text-red-400"   :
    driverState === "parking_detected" ? "text-amber-400" : "text-emerald-400";

  const stateDot =
    driverState === "violating"
      ? "bg-red-500 shadow-[0_0_10px_#ef4444]"
      : driverState === "parking_detected"
      ? "bg-amber-500 shadow-[0_0_10px_#f59e0b]"
      : "bg-emerald-500 shadow-[0_0_10px_#10b981]";

  const cdPct = (countdown / VIOLATION_TIMEOUT) * 100;
  const cdBarColor =
    countdown > 6 ? "bg-amber-400"  :
    countdown > 3 ? "bg-orange-500" : "bg-red-500";

  // Radar blip X position (mapped per scenario) and Z progress
  const radarBlipX  = uiScenario === 1 ? 63 : uiScenario === 2 ? 34 : 74;
  const zProgress   = 1 - Math.max(0, Math.min(1, (violatorZ - cfg.zone.z) / (CITY_SIZE - cfg.zone.z)));
  const radarBlipY  = 20 + zProgress * 52;  // maps vehicle Z to radar Y (top=far, bottom=zone)

  const eTicketStatus =
    driverState === "violating"        ? "TRANSMITTING" :
    driverState === "parking_detected" ? "STANDBY"      : "IDLE";
  const eTicketColor =
    driverState === "violating"        ? "text-red-400"    :
    driverState === "parking_detected" ? "text-amber-400"  : "text-slate-600";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ background: "#050d1a", fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700;800&display=swap');
        @keyframes alertIn    { from{opacity:0;transform:translate(-50%,-54%) scale(.86)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes slideDown  { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scanline   { 0%{top:-2px} 100%{top:100%} }
        @keyframes gridPulse  { 0%,100%{opacity:.05} 50%{opacity:.1} }
        @keyframes blink      { 0%,100%{opacity:1} 50%{opacity:.22} }
        @keyframes radarSweep { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes syncFlash  { 0%{opacity:1;transform:scale(1.08)} 100%{opacity:0;transform:scale(1)} }
        @keyframes countShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }
        @keyframes fadeIn     { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .blink       { animation:blink 1.1s ease-in-out infinite; }
        .radarSweep  { animation:radarSweep 4s linear infinite; transform-origin:48px 48px; }
        .scanline-bar{ position:absolute;left:0;right:0;height:2px;
                       background:linear-gradient(90deg,transparent,rgba(6,182,212,.2),transparent);
                       animation:scanline 7s linear infinite; }
        .count-shake { animation:countShake .25s ease-in-out; }
      `}</style>

      {/* Canvas */}
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Scanline */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        <div className="scanline-bar" />
      </div>

      {/* Grid */}
      <div className="pointer-events-none absolute inset-0 z-10" style={{
        backgroundImage:
          "linear-gradient(rgba(6,182,212,.055) 1px,transparent 1px)," +
          "linear-gradient(90deg,rgba(6,182,212,.055) 1px,transparent 1px)",
        backgroundSize: "44px 44px",
        animation: "gridPulse 5s ease-in-out infinite",
      }} />

      {/* ── TOP BAR ────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none
                      flex items-center justify-between px-5 py-3
                      border-b border-cyan-500/20
                      bg-gradient-to-b from-[#050d1a]/96 to-[#050d1a]/55 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded border border-cyan-500/60 bg-cyan-500/10
                          flex items-center justify-center shadow-[0_0_14px_rgba(6,182,212,0.3)]">
            <div className="w-3 h-3 rounded-sm bg-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-black tracking-[0.42em] text-cyan-300">VISTA</div>
            <div className="text-[7px] tracking-[0.26em] text-slate-500 uppercase">Smart City Violation System</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[9px] tracking-widest">
          <div className={`px-2.5 py-1 rounded border text-[8px] font-bold ${ac.badge}`}>
            {cfg.icon}&nbsp;{cfg.sub.toUpperCase()} · {cfg.label}
          </div>
          <span className="text-slate-500">
            WIB&nbsp;<span className="text-slate-300">{clock12}</span>
          </span>
          <span className="text-slate-500">
            FPS&nbsp;
            <span className={fps >= 50 ? "text-emerald-400" : fps >= 30 ? "text-amber-400" : "text-red-400"}>
              {fps}
            </span>
          </span>
          {/* Log toggle */}
          <button
            className="pointer-events-auto px-2.5 py-1 rounded border border-slate-700/60
                       text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-colors
                       flex items-center gap-1.5"
            onClick={() => setShowLog(v => !v)}
          >
            <span className="text-[8px] font-bold">LOG</span>
            {violationLog.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500/80 text-white text-[7px] flex items-center justify-center font-black">
                {violationLog.length > 9 ? "9+" : violationLog.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── SCENARIO MENU ──────────────────────────────────────────────── */}
      <div id="scen-menu" className="absolute top-[58px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2.5">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="pointer-events-auto flex items-center gap-2.5 px-5 py-2 rounded-full
                     bg-[#050d1a]/90 border border-slate-700/70 backdrop-blur-md
                     text-[9px] font-bold tracking-[0.28em] text-slate-300
                     hover:border-cyan-500/50 hover:text-cyan-300 transition-all duration-200
                     shadow-[0_4px_24px_rgba(0,0,0,0.5)]
                     hover:shadow-[0_4px_24px_rgba(6,182,212,0.2)]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          PILIH SKENARIO
          <span className="text-slate-600 text-[8px] ml-1">{menuOpen ? "▲" : "▼"}</span>
        </button>

        {menuOpen && (
          <div className="flex gap-3 pointer-events-auto" style={{ animation: "slideDown .2s ease-out" }}>
            {SCENARIOS.map(s => {
              const sa     = AC[s.accent];
              const active = uiScenario === s.id;
              const cnt    = countersUi[s.id];
              return (
                <button key={s.id} onClick={() => switchScenario(s.id)}
                  className={`relative flex flex-col gap-1.5 px-4 py-3.5 rounded-2xl border backdrop-blur-md
                    transition-all duration-200 min-w-[155px] text-left hover:scale-[1.03]
                    ${active
                      ? `${sa.bg} ${sa.border} ${sa.glow} scale-[1.04]`
                      : "bg-[#0b1628]/90 border-slate-700/60 hover:border-slate-500"}`}
                >
                  {active && <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${sa.dot} animate-pulse`} />}
                  {cnt > 0 && !active && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500/70
                                    text-white text-[7px] flex items-center justify-center font-black">
                      {cnt}
                    </div>
                  )}
                  <span className="text-xl leading-none">{s.icon}</span>
                  <div>
                    <div className={`text-[8px] font-black tracking-[0.2em] ${active ? sa.text : "text-slate-500"}`}>
                      {s.label}
                    </div>
                    <div className={`text-[12px] font-bold mt-0.5 ${active ? "text-white" : "text-slate-300"}`}>
                      {s.sub}
                    </div>
                  </div>
                  <div className="text-[8px] text-slate-500 leading-snug">{s.desc}</div>
                  <div className={`text-[8px] font-bold mt-1 ${active ? sa.text : "text-slate-600"}`}>
                    {cnt > 0 ? `${cnt}× tercatat` : "Belum ada pelanggaran"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── LEFT HUD ───────────────────────────────────────────────────── */}
      <div className="absolute left-4 top-[72px] z-20 flex flex-col gap-2.5 pointer-events-none w-[232px]">

        {/* AI Tracker Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#07101f]/92 backdrop-blur-md
                        shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className={`flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 ${ac.bg}`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${stateDot}`} />
              <span className="text-[9px] font-black tracking-[0.22em] text-white/75">AI TRACKER</span>
            </div>
            <span className={`text-[8px] font-black tracking-wider blink ${stateColor}`}>● {stateLabel}</span>
          </div>

          <div className="px-4 py-3 space-y-2.5 text-[9px]">
            {/* Kendaraan */}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 tracking-wider">KENDARAAN</span>
              <span className={`font-bold uppercase ${ac.text}`}>{cfg.violatorType}</span>
            </div>
            {/* Plat */}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 tracking-wider">PLAT NOMOR</span>
              <span className="font-black text-white bg-slate-800 px-2 py-0.5 rounded text-[8px] tracking-widest border border-slate-700/50">
                {cfg.plate}
              </span>
            </div>
            {/* Jalur aktif */}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 tracking-wider">JALUR</span>
              <span className={`text-[8px] font-bold ${ac.text}`}>{cfg.sub}</span>
            </div>

            {/* Speed meter with scale markers */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-slate-500 tracking-wider">KECEPATAN</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-[16px] font-black tabular-nums leading-none ${
                    kmh > 0 ? "text-cyan-300" : "text-slate-600"
                  }`}>{kmh}</span>
                  <span className="text-[8px] text-slate-600">km/h</span>
                </div>
              </div>
              {/* Bar with scale */}
              <div className="relative">
                <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/40">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${kmh > 0 ? "bg-cyan-400" : "bg-slate-700"}`}
                    style={{ width: `${Math.min(100, (kmh / 80) * 100)}%`, boxShadow: kmh > 0 ? "0 0 8px rgba(34,211,238,0.6)" : "none" }}
                  />
                </div>
                {/* Scale ticks */}
                <div className="flex justify-between mt-0.5 px-0.5">
                  {[0, 20, 40, 60, 80].map(v => (
                    <span key={v} className="text-[6px] text-slate-700">{v}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Position Z readout */}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 tracking-wider">POSISI Z</span>
              <span className="text-slate-400 font-mono text-[8px] tabular-nums">
                {violatorZ.toFixed(1)} m
              </span>
            </div>

            {/* Zona deteksi */}
            <div className="pt-1 border-t border-slate-800/60">
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-500 tracking-wider">ZONA TARGET</span>
                <span className="text-slate-400 font-mono text-[8px]">X:{cfg.zone.x} Z:{cfg.zone.z}</span>
              </div>
              <div className={`text-[7px] text-slate-600 leading-snug px-2 py-1.5 rounded-lg border ${ac.border} ${ac.bg}`}>
                {cfg.laneDesc}
              </div>
            </div>
          </div>

          {/* Countdown panel */}
          {driverState === "parking_detected" && (
            <div className="px-4 pb-4 pt-1 border-t border-slate-800/60">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[8px] font-bold text-amber-400 tracking-wider blink">⚠ SENSOR TIMEOUT</span>
                <div className={`text-[22px] font-black tabular-nums leading-none text-white
                                 ${countdown <= 3 ? "blink" : ""}`}
                  style={countdown <= 3 ? { animation: "countShake .25s ease-in-out infinite, blink 1.1s infinite" } : {}}>
                  {countdown}
                  <span className="text-[10px] text-slate-500 ml-0.5">s</span>
                </div>
              </div>
              {/* Countdown bar */}
              <div className="relative h-3 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/40">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${cdBarColor}`}
                  style={{ width: `${cdPct}%`, boxShadow: "0 0 10px currentColor" }}
                />
                {/* tick marks */}
                {[10,20,30,40,50,60,70,80,90].map(p => (
                  <div key={p} className="absolute top-0 bottom-0 w-px bg-slate-950/70"
                    style={{ left: `${p}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-[6px] text-slate-700 mt-0.5 px-0.5">
                {[10,9,8,7,6,5,4,3,2,1,0].map(v => (
                  <span key={v}>{v}</span>
                ))}
              </div>
              <div className="text-[7px] text-slate-600 mt-1.5 tracking-wider text-center">
                E-TICKET OTOMATIS DIKIRIM SAAT TIMER = 0
              </div>
            </div>
          )}
        </div>

        {/* DB Sync counter */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#07101f]/92 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center gap-2">
            <span className="text-[9px] font-black tracking-[0.22em] text-slate-400">DATABASE SYNC</span>
            <div className="ml-auto flex gap-1 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[7px] text-emerald-500 font-bold tracking-wider">LIVE</span>
            </div>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {SCENARIOS.map(s => {
              const sa   = AC[s.accent];
              const act  = uiScenario === s.id;
              const cnt  = countersUi[s.id];
              const flash = syncFlash === s.id;
              return (
                <div key={s.id}
                  className={`relative flex items-center gap-2.5 py-1.5 px-2.5 rounded-xl
                              transition-all duration-200
                              ${act ? `${sa.bg} border ${sa.border}` : "border border-transparent"}`}
                >
                  {/* sync flash overlay */}
                  {flash && (
                    <div className={`absolute inset-0 rounded-xl ${sa.bar} opacity-30`}
                      style={{ animation: "syncFlash .6s ease-out forwards" }} />
                  )}
                  <span className="text-base w-5 leading-none">{s.icon}</span>
                  <span className={`text-[8px] flex-1 tracking-wide ${act ? "text-white font-bold" : "text-slate-500"}`}>
                    {s.sub}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {cnt > 0 && (
                      <div className={`w-1.5 h-1.5 rounded-full ${sa.dot} ${act ? "animate-pulse" : ""}`} />
                    )}
                    <span className={`text-[14px] font-black tabular-nums w-5 text-right
                                     ${cnt > 0 ? sa.text : "text-slate-700"}
                                     ${flash ? "blink" : ""}`}>
                      {cnt}
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-slate-800/60 flex justify-between text-[8px]">
              <span className="text-slate-600">Total Pelanggaran</span>
              <span className="text-white font-black">
                {Object.values(countersUi).reduce((a, b) => a + b, 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Lane legend */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#07101f]/92 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800/60">
            <span className="text-[9px] font-black tracking-[0.22em] text-slate-400">LANE MAP</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {[
              { hex: "#7f1d1d", label: "Busway Lane",  scn: "SCN-02", accent: "rose" },
              { hex: "#052e16", label: "Bicycle Lane", scn: "SCN-01", accent: "emerald" },
              { hex: "#334155", label: "Sidewalk",     scn: "SCN-03", accent: "amber" },
            ].map(({ hex, label, scn, accent: la }) => {
              const laSa = AC[la];
              return (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-4 h-2.5 rounded-sm border border-white/8 flex-shrink-0"
                    style={{ background: hex }} />
                  <span className="text-[8px] text-slate-400 flex-1">{label}</span>
                  <span className={`text-[7px] font-bold ${laSa.text}`}>{scn}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2.5 pt-1.5 border-t border-slate-800/60">
              <div className={`w-4 h-2.5 rounded-sm ${ac.bar} opacity-70 flex-shrink-0`} />
              <span className={`text-[8px] font-bold flex-1 ${ac.text}`}>{cfg.icon} Active Zone</span>
              <span className={`text-[7px] font-bold ${ac.text}`}>{cfg.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT HUD ──────────────────────────────────────────────────── */}
      <div className="absolute right-4 top-[72px] z-20 pointer-events-none flex flex-col gap-2.5 w-[192px]">

        {/* Radar with live blip tracking */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#07101f]/92 backdrop-blur-md shadow-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center justify-between">
            <span className="text-[9px] font-black tracking-[0.22em] text-slate-400">ZONE RADAR</span>
            <div className="flex gap-1 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            </div>
          </div>
          <div className="p-4 flex justify-center">
            <div className="w-[120px] h-[120px]">
              <svg viewBox="0 0 96 96" className="w-full h-full">
                <circle cx={48} cy={48} r={44} fill="rgba(6,182,212,0.03)" />
                {[44, 32, 21, 11].map(r => (
                  <circle key={r} cx={48} cy={48} r={r} fill="none"
                    stroke="rgba(6,182,212,0.18)" strokeWidth="0.6" strokeDasharray="2 3" />
                ))}
                <line x1={4} y1={48} x2={92} y2={48} stroke="rgba(6,182,212,0.1)" strokeWidth="0.5" />
                <line x1={48} y1={4} x2={48} y2={92} stroke="rgba(6,182,212,0.1)" strokeWidth="0.5" />
                <defs>
                  <radialGradient id="rg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(48 48) scale(44)">
                    <stop offset="0%" stopColor="rgba(6,182,212,0.7)" />
                    <stop offset="100%" stopColor="rgba(6,182,212,0)" />
                  </radialGradient>
                </defs>
                <path d="M48,48 L92,48 A44,44 0 0,1 75,79 Z" fill="url(#rg)" className="radarSweep" />

                {/* Zone target marker (fixed) */}
                <rect
                  x={radarBlipX - 4} y={68}
                  width={8} height={5}
                  fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"
                  rx="1"
                />

                {/* Live vehicle blip (moves with vehicle Z position) */}
                <circle cx={radarBlipX} cy={radarBlipY} r={2.5}
                  fill="rgba(6,182,212,0.5)"
                  style={{ filter: "drop-shadow(0 0 3px rgba(6,182,212,0.8))" }}
                />

                {/* Violation blip (only when stopped) */}
                {driverState !== "moving" && (
                  <>
                    <circle cx={radarBlipX} cy={70} r={7}
                      fill={driverState === "violating" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)"} />
                    <circle cx={radarBlipX} cy={70} r={3.5}
                      fill={driverState === "violating" ? "#ef4444" : "#f59e0b"}
                      style={{ filter: `drop-shadow(0 0 5px ${driverState === "violating" ? "#ef4444" : "#f59e0b"})` }}
                    >
                      <animate attributeName="r" values="3;4.5;3" dur="0.8s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
              </svg>
            </div>
          </div>
          <div className="px-4 pb-3.5 border-t border-slate-800/60 pt-2
                          grid grid-cols-2 gap-x-2 gap-y-1.5">
            {[
              ["TGT-X",   cfg.zone.x.toFixed(1), ac.text],
              ["TGT-Z",   cfg.zone.z.toFixed(1), ac.text],
              ["VEH-Z",   violatorZ.toFixed(1),   "text-cyan-400"],
              ["SPEED",   `${kmh} km/h`,           "text-cyan-400"],
              ["STATUS",  stateLabel.split(" ")[0], stateColor],
              ["SCEN",    cfg.label,               ac.text],
            ].map(([label, val, cls]) => (
              <React.Fragment key={label as string}>
                <div className="text-[7px] text-slate-600 tracking-wider">{label}</div>
                <div className={`text-[8px] font-bold text-right tabular-nums ${cls}`}>{val}</div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* System Status with detailed states */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#07101f]/92 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800/60">
            <span className="text-[9px] font-black tracking-[0.22em] text-slate-400">SYS STATUS</span>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            {[
              { label: "AI Detection",  status: "ONLINE",   color: "text-emerald-400", dot: "bg-emerald-500" },
              { label: "Sensor Grid",   status: "ONLINE",   color: "text-emerald-400", dot: "bg-emerald-500" },
              { label: "CCTV Stream",   status: "ONLINE",   color: "text-emerald-400", dot: "bg-emerald-500" },
              { label: "Database Sync", status: "ONLINE",   color: "text-emerald-400", dot: "bg-emerald-500" },
              {
                label: "E-Ticket API",
                status: eTicketStatus,
                color: eTicketColor,
                dot: driverState === "violating" ? "bg-red-500 animate-ping" :
                     driverState === "parking_detected" ? "bg-amber-500 animate-pulse" : "bg-slate-700"
              },
            ].map(({ label, status, color, dot }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[8px] text-slate-500">{label}</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  <span className={`text-[7px] font-bold tracking-wider ${color}
                                   ${status === "TRANSMITTING" ? "blink" : ""}`}>
                    {status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Skenario Info Box */}
          <div className={`mx-3 mb-3 p-2.5 rounded-xl border ${ac.border} ${ac.bg}`}>
            <div className={`text-[7px] font-black tracking-widest ${ac.text} mb-1`}>
              ACTIVE SCENARIO
            </div>
            <div className="text-[9px] font-bold text-white">{cfg.icon} {cfg.sub}</div>
            <div className="text-[7px] text-slate-500 mt-0.5 leading-snug">{cfg.desc}</div>
          </div>
        </div>
      </div>

      {/* ── VIOLATION LOG PANEL ─────────────────────────────────────────── */}
      {showLog && (
        <div className="absolute top-[72px] right-[208px] z-30 w-[280px]
                        rounded-2xl border border-slate-700/70 bg-[#07101f]/96
                        backdrop-blur-md shadow-2xl overflow-hidden pointer-events-auto"
          style={{ animation: "slideDown .2s ease-out" }}>
          <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center justify-between">
            <span className="text-[9px] font-black tracking-[0.2em] text-slate-400">
              VIOLATION LOG
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-slate-600">{violationLog.length} entri</span>
              <button onClick={() => setShowLog(false)}
                className="text-slate-600 hover:text-slate-300 text-[10px] font-bold">✕</button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[320px] scrollbar-hide">
            {violationLog.length === 0 ? (
              <div className="px-4 py-6 text-center text-[8px] text-slate-600">
                Belum ada pelanggaran tercatat
              </div>
            ) : (
              violationLog.map((log, idx) => {
                const lsa = AC[SCENARIOS[log.scenario - 1].accent];
                return (
                  <div key={log.id}
                    className={`px-4 py-2.5 border-b border-slate-800/40 flex gap-2.5
                                ${idx === 0 ? "bg-slate-800/20" : ""}`}
                    style={idx === 0 ? { animation: "fadeIn .3s ease-out" } : {}}
                  >
                    <span className="text-lg leading-none mt-0.5">{log.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-black text-white bg-slate-800
                                         px-1.5 rounded tracking-widest">{log.plate}</span>
                        <span className="text-[7px] text-slate-600 tabular-nums">{log.timestamp}</span>
                      </div>
                      <div className={`text-[7px] font-bold mt-0.5 ${lsa.text} truncate`}>{log.type}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[6px] text-slate-600">{SCENARIOS[log.scenario - 1].sub}</span>
                        <span className="text-slate-700">·</span>
                        <span className="text-[6px] text-emerald-600">AI {log.confidence}%</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {violationLog.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-800/60">
              <button
                onClick={() => setViolationLog([])}
                className="text-[7px] text-slate-600 hover:text-red-400 transition-colors font-bold tracking-wider"
              >
                HAPUS SEMUA LOG
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSITION OVERLAY ──────────────────────────────────────────── */}
      {transitioning && (
        <div className="absolute inset-0 z-50 bg-[#050d1a]/80 backdrop-blur-sm
                        flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-slate-800 border-t-cyan-400 animate-spin" />
            <div className="text-[9px] font-black tracking-[0.35em] text-cyan-400 blink">
              LOADING {cfg.label}...
            </div>
          </div>
        </div>
      )}

      {/* ── CRITICAL ALERT POPUP ────────────────────────────────────────── */}
      {alert && (
        <div className="absolute top-1/2 left-1/2 z-50 pointer-events-none"
          style={{ width: 410, animation: "alertIn .4s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
          <div className="absolute -inset-6 rounded-3xl bg-red-500/12 blur-2xl" />
          <div className="relative rounded-2xl border border-red-600/60 bg-[#07101f]/98 overflow-hidden
                          shadow-[0_24px_80px_rgba(239,68,68,0.55),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />

            {/* Header */}
            <div className="px-5 py-3 border-b border-red-900/50
                            bg-gradient-to-r from-red-950/70 to-[#07101f]/70
                            flex items-center gap-2.5">
              <div className="relative w-3 h-3">
                <div className="absolute inset-0 rounded-full bg-red-500 animate-ping" />
                <div className="w-3 h-3 rounded-full bg-red-500" />
              </div>
              <span className="text-[10px] font-black tracking-[0.15em] text-red-300">
                ⚠ CRITICAL — VIOLATION CONFIRMED
              </span>
              <div className={`ml-auto text-[8px] font-bold px-2 py-0.5 rounded border ${ac.badge}`}>
                {cfg.icon} {cfg.sub}
              </div>
            </div>

            {/* Plate */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl
                              bg-slate-900/60 border border-slate-800/60">
                <span className="text-[8px] text-slate-500 tracking-widest">NOMOR PLAT</span>
                <span className="text-[18px] font-black text-slate-900 bg-amber-400
                                 px-3 py-0.5 rounded-lg tracking-[0.12em]
                                 shadow-[0_0_20px_rgba(245,158,11,0.6)]">
                  {alert.plate}
                </span>
              </div>
            </div>

            {/* Detail grid */}
            <div className="px-5 pb-3 grid grid-cols-2 gap-2">
              {[
                { label: "PELANGGARAN", val: alert.type,          cls: `${ac.text} text-right text-[8px] leading-tight` },
                { label: "DURASI STOP", val: "> 10.00 DETIK",     cls: "text-red-400" },
                { label: "ZONA",        val: cfg.sub,              cls: `${ac.text} font-black` },
                { label: "AI CONF",     val: `${alert.confidence}%`, cls: "text-emerald-400 font-black" },
                { label: "TIMESTAMP",   val: alertTimestamp,       cls: "text-slate-300 text-[8px] col-span-1" },
                { label: "SKENARIO",    val: cfg.label,            cls: `${ac.text} font-black` },
              ].map(({ label, val, cls }) => (
                <div key={label} className="py-2 px-2.5 rounded-xl bg-slate-900/50 border border-slate-800/50">
                  <div className="text-[7px] text-slate-600 tracking-widest mb-0.5">{label}</div>
                  <div className={`text-[9px] font-bold leading-tight ${cls}`}>{val}</div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 pb-4">
              <div className="py-2.5 px-3 rounded-xl border border-red-900/50
                              bg-gradient-to-r from-red-950/60 to-rose-950/40
                              text-center text-[8px] font-black tracking-[0.26em]
                              text-red-400 blink">
                ✓ AUTOMATED E-TICKET SIGNED &amp; SENT TO SERVER
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}