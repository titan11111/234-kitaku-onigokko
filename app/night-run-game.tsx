"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EyeOff, Footprints, House, LogOut, Route, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

type Phase = "intro" | "playing" | "won" | "caught";
type HideSpot = { label: string; position: THREE.Vector3; ring: THREE.Mesh };
type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
type HudState = {
  stamina: number;
  staminaSeconds: number;
  recoverySeconds: number;
  distance: number;
  oniDistance: number;
  danger: number;
  hidden: boolean;
  exhausted: boolean;
  nearHide: boolean;
  hideLabel: string;
  nextHideLabel: string;
  nextHideDistance: number;
  nextHideSide: string;
  aiLabel: string;
  elapsed: number;
};
type GameApi = { start: () => void; interact: () => void };
type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
type WebMcpContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

const HOME = new THREE.Vector3(4, 0, -107);
const PLAYER_START = new THREE.Vector3(0, 0, 95);
const ONI_START = new THREE.Vector3(-1.5, 0, 112);
const START_GRACE_SECONDS = 2.5;
const INITIAL_HUD: HudState = {
  stamina: 100,
  staminaSeconds: 10,
  recoverySeconds: 0,
  distance: 284,
  oniDistance: 24,
  danger: 0.5,
  hidden: false,
  exhausted: false,
  nearHide: false,
  hideLabel: "",
  nextHideLabel: "",
  nextHideDistance: 0,
  nextHideSide: "",
  aiLabel: "接近中",
  elapsed: 0,
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
}

function resultCopy(phase: Phase) {
  return phase === "won"
    ? {
        eyebrow: "00:02　自宅前",
        title: "鍵が、開いた。",
        body: "ドアを閉めた瞬間、外の足音が止まった。今夜はもう、振り返らなくていい。",
        action: "もう一度帰る",
      }
    : {
        eyebrow: "帰宅失敗",
        title: "背後に、いた。",
        body: "走り続けるだけでは逃げ切れない。街の死角で鬼の視線を切ろう。",
        action: "駅前からやり直す",
      };
}

export default function NightRunGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("intro");
  const gameApi = useRef<GameApi | null>(null);
  const mobile = useRef({ x: 0, y: 0, dash: false });
  const [phase, setPhase] = useState<Phase>("intro");
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const statusRef = useRef({ phase, hud });
  statusRef.current = { phase, hud };

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05080b);
    scene.fog = new THREE.Fog(0x070a0d, 24, 78);

    const camera = new THREE.PerspectiveCamera(53, 1, 0.1, 180);
    camera.position.set(10.5, 15.8, 108);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.setAttribute("role", "application");
    renderer.domElement.setAttribute("aria-label", "駅から自宅へ逃げる3D鬼ごっこゲーム");
    mount.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);
    scene.add(new THREE.HemisphereLight(0x8195aa, 0x111416, 1.3));
    const moon = new THREE.DirectionalLight(0x9db8d1, 1.2);
    moon.position.set(-18, 28, 22);
    scene.add(moon);

    const colliders: Collider[] = [];
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x151a1d, roughness: 0.34, metalness: 0.34 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x2c3030, roughness: 0.9 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x515552, roughness: 0.82 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111619, roughness: 0.9 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xc9c7bb, roughness: 0.75 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xa81712, roughness: 0.72 });
    const warmMat = new THREE.MeshStandardMaterial({
      color: 0xf5d88e,
      emissive: 0xd1912f,
      emissiveIntensity: 2.7,
      roughness: 0.46,
    });

    const addBox = (
      size: [number, number, number],
      position: [number, number, number],
      material: THREE.Material,
      collider = false,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
      mesh.position.set(position[0], position[1], position[2]);
      world.add(mesh);
      if (collider) {
        colliders.push({
          minX: position[0] - size[0] / 2,
          maxX: position[0] + size[0] / 2,
          minZ: position[2] - size[2] / 2,
          maxZ: position[2] + size[2] / 2,
        });
      }
      return mesh;
    };

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 250), darkMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.04;
    world.add(ground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(15, 226), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.005, 1);
    world.add(road);
    addBox([5, 0.16, 226], [-10, 0.08, 1], sidewalkMat);
    addBox([5, 0.16, 226], [10, 0.08, 1], sidewalkMat);
    addBox([0.18, 0.27, 226], [-7.55, 0.12, 1], curbMat);
    addBox([0.18, 0.27, 226], [7.55, 0.12, 1], curbMat);

    for (let z = 101; z > -105; z -= 12) addBox([0.13, 0.025, 5.4], [0, 0.035, z], whiteMat);
    [76, 26, -24, -74].forEach((z) => {
      const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(58, 10), roadMat);
      crossRoad.rotation.x = -Math.PI / 2;
      crossRoad.position.set(0, 0.012, z);
      world.add(crossRoad);
      for (let x = -6.7; x <= 6.7; x += 1.55) addBox([0.88, 0.024, 3.7], [x, 0.04, z - 2.4], whiteMat);
    });

    const buildingColors = [0x1b2428, 0x20272a, 0x27282a, 0x182126, 0x252321];
    [92, 64, 38, 10, -18, -46, -74, -98].forEach((z, i) => {
      [-1, 1].forEach((side) => {
        const width = 9 + ((i + side + 2) % 2);
        const height = 8 + ((i * 3 + side + 2) % 6);
        const centerX = side * (17.1 + ((i + 1) % 2) * 0.7);
        const buildingMat = new THREE.MeshStandardMaterial({
          color: buildingColors[(i + (side === 1 ? 2 : 0)) % buildingColors.length],
          roughness: 0.86,
        });
        addBox([width, height, 19], [centerX, height / 2, z], buildingMat, true);
        [-5.4, 0, 5.4].forEach((wz) => {
          [2.6, 5.1].forEach((wy) => {
            if ((i + Math.round(wz) + Math.round(wy) + side) % 3 === 0) return;
            const lit = (i + Math.round(wz) + side) % 4 === 0;
            const windowMat = new THREE.MeshStandardMaterial({
              color: lit ? 0xd3b66b : 0x182024,
              emissive: lit ? 0x9b6a24 : 0,
              emissiveIntensity: lit ? 1.5 : 0,
            });
            addBox([0.08, 0.78, 1.26], [side * 12.18, wy, z + wz], windowMat);
          });
        });
      });
    });

    const makeLabel = (text: string, foreground: string, background: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 144;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = background;
        context.fillRect(0, 0, 512, 144);
        context.strokeStyle = "rgba(240,211,144,.55)";
        context.lineWidth = 5;
        context.strokeRect(4, 4, 504, 136);
        context.fillStyle = foreground;
        context.font = "700 58px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(text, 256, 76);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.scale.set(5.8, 1.62, 1);
      return sprite;
    };

    const stationMat = new THREE.MeshStandardMaterial({ color: 0x2b3033, roughness: 0.68, metalness: 0.28 });
    addBox([20, 0.5, 7], [0, 4.9, 112], stationMat);
    addBox([1, 5, 1], [-8.5, 2.5, 112], stationMat);
    addBox([1, 5, 1], [8.5, 2.5, 112], stationMat);
    const stationLabel = makeLabel("烏森駅　東口", "#f4ead0", "rgba(6,10,12,.86)");
    stationLabel.position.set(0, 5.4, 108.3);
    world.add(stationLabel);
    const stationLight = new THREE.PointLight(0xffd89a, 14, 23, 2.1);
    stationLight.position.set(0, 4.2, 106);
    world.add(stationLight);

    const homeMat = new THREE.MeshStandardMaterial({ color: 0x293036, roughness: 0.8 });
    addBox([13, 7.5, 10], [4, 3.75, -114], homeMat);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(9.3, 3.4, 4),
      new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.9 }),
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(4, 9.05, -114);
    world.add(roof);
    addBox(
      [2.1, 3.3, 0.24],
      [4, 1.65, -108.9],
      new THREE.MeshStandardMaterial({ color: 0x7e5f36, emissive: 0x7b4f18, emissiveIntensity: 0.42 }),
    );
    addBox([2.8, 0.15, 1.3], [4, 3.52, -108.55], warmMat);
    const homeLight = new THREE.PointLight(0xffc96b, 24, 20, 2);
    homeLight.position.set(4, 3.5, -106.5);
    world.add(homeLight);
    const homeLabel = makeLabel("自宅", "#fff5cf", "rgba(65,42,10,.82)");
    homeLabel.position.set(4, 5.7, -108.6);
    homeLabel.scale.set(3.4, 0.95, 1);
    world.add(homeLabel);

    const lampMetal = new THREE.MeshStandardMaterial({ color: 0x30383b, roughness: 0.4, metalness: 0.72 });
    for (let z = 94, i = 0; z > -101; z -= 22, i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.8, 8), lampMetal);
      pole.position.set(side * 7.05, 2.9, z);
      world.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), warmMat);
      lamp.position.set(side * 7.05, 5.75, z);
      world.add(lamp);
      if (i % 2 === 0) {
        const light = new THREE.PointLight(0xffd68b, 8.5, 15, 2.2);
        light.position.copy(lamp.position);
        world.add(light);
      }
    }

    const glassMat = new THREE.MeshStandardMaterial({ color: 0x81939b, roughness: 0.22, metalness: 0.35 });
    const addCar = (x: number, z: number, color: number) => {
      const carMat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.55 });
      addBox([3.1, 0.75, 5.6], [x, 0.72, z], carMat, true);
      addBox([2.55, 0.72, 2.8], [x, 1.42, z + 0.2], glassMat);
      [-1, 1].forEach((sx) => {
        [-1.65, 1.65].forEach((sz) => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), darkMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x + sx * 1.48, 0.47, z + sz);
          world.add(wheel);
        });
      });
    };
    addCar(4.6, 57, 0x4c2020);
    addCar(-4.4, 14, 0x26313a);
    addCar(4.2, -35, 0x303238);
    addCar(-4.6, -68, 0x453d2b);

    const hideSpots: HideSpot[] = [];
    const hideData: Array<[number, number, string, number]> = [
      [9.65, 77, "バス停の死角", 0x79b6c9],
      [-9.65, 39, "配送車の陰", 0xd2a75d],
      [9.65, 1, "自販機の隙間", 0x6ca19d],
      [-9.65, -43, "公園トイレの裏", 0x9a8eb2],
      [9.65, -81, "月極車庫", 0xb8875e],
    ];
    hideData.forEach((data, index) => {
      const x = data[0];
      const z = data[1];
      const label = data[2];
      const color = data[3];
      const side = Math.sign(x);
      const shelterMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.18 });
      addBox([0.28, 2.8, 4.2], [side * 11.15, 1.45, z], shelterMat);
      addBox([2.6, 0.18, 4.2], [side * 9.98, 2.82, z], shelterMat);
      if (index === 2) {
        addBox([1.05, 2.15, 1.35], [side * 9.85, 1.12, z - 1.25], redMat);
        addBox([1.05, 2.15, 1.35], [side * 9.85, 1.12, z + 1.25], whiteMat);
      } else if (index === 1) {
        addBox([1.8, 1.7, 3.3], [side * 10.1, 1, z], whiteMat);
      } else {
        addBox([0.18, 2.25, 1.2], [side * 8.82, 1.2, z - 1.5], shelterMat);
      }
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.64, 0.9, 30),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.2, z);
      world.add(ring);
      hideSpots.push({ label, position: new THREE.Vector3(x, 0, z), ring });
    });

    const createSalaryman = () => {
      const group = new THREE.Group();
      const suit = new THREE.MeshStandardMaterial({ color: 0x25313c, roughness: 0.68 });
      const shirt = new THREE.MeshStandardMaterial({ color: 0xd6d7d1, roughness: 0.75 });
      const skin = new THREE.MeshStandardMaterial({ color: 0xb98566, roughness: 0.8 });
      const black = new THREE.MeshStandardMaterial({ color: 0x101316, roughness: 0.7 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.25, 0.46), suit);
      torso.position.y = 1.63;
      group.add(torso);
      const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.86, 0.05), shirt);
      shirtFront.position.set(0, 1.78, -0.255);
      group.add(shirtFront);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.04), redMat);
      tie.position.set(0, 1.83, -0.292);
      group.add(tie);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), skin);
      head.position.y = 2.62;
      group.add(head);
      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.95, 0.32), suit);
      leftLeg.position.set(-0.24, 0.55, 0);
      group.add(leftLeg);
      const rightLeg = leftLeg.clone();
      rightLeg.position.x = 0.24;
      group.add(rightLeg);
      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.05, 0.28), suit);
      leftArm.position.set(-0.59, 1.65, 0);
      group.add(leftArm);
      const rightArm = leftArm.clone();
      rightArm.position.x = 0.59;
      group.add(rightArm);
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.62, 0.22), black);
      bag.position.set(0.79, 0.93, 0.02);
      group.add(bag);
      group.userData = { leftLeg, rightLeg, leftArm, rightArm, bag };
      return group;
    };

    const createOni = () => {
      const group = new THREE.Group();
      const skin = new THREE.MeshStandardMaterial({ color: 0x8f1714, roughness: 0.66 });
      const deepRed = new THREE.MeshStandardMaterial({ color: 0x4e0c0a, roughness: 0.8 });
      const coat = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.92 });
      const horn = new THREE.MeshStandardMaterial({ color: 0xd3bd88, roughness: 0.82 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.55, 0.65), coat);
      torso.position.y = 1.72;
      group.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), skin);
      head.position.y = 2.9;
      group.add(head);
      [-1, 1].forEach((side) => {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.72, 10), horn);
        h.position.set(side * 0.28, 3.48, 0);
        h.rotation.z = side * -0.2;
        group.add(h);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
        eye.position.set(side * 0.17, 2.98, -0.43);
        group.add(eye);
      });
      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.12, 0.39), deepRed);
      leftLeg.position.set(-0.32, 0.58, 0);
      group.add(leftLeg);
      const rightLeg = leftLeg.clone();
      rightLeg.position.x = 0.32;
      group.add(rightLeg);
      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.31, 1.25, 0.34), skin);
      leftArm.position.set(-0.79, 1.72, -0.03);
      group.add(leftArm);
      const rightArm = leftArm.clone();
      rightArm.position.x = 0.79;
      group.add(rightArm);
      group.userData = { leftLeg, rightLeg, leftArm, rightArm, head };
      return group;
    };

    const player = createSalaryman();
    player.position.copy(PLAYER_START);
    world.add(player);
    const oni = createOni();
    oni.position.copy(ONI_START);
    world.add(oni);
    const oniGlow = new THREE.PointLight(0xd92818, 7, 9, 2.2);
    oniGlow.position.set(0, 2.4, 0);
    oni.add(oniGlow);

    const keys = new Set<string>();
    const clearInput = () => {
      keys.clear();
      mobile.current = { x: 0, y: 0, dash: false };
      const knob = mount.querySelector<HTMLElement>(".touch-stick-knob");
      if (knob) knob.style.transform = "translate(-50%, -50%)";
    };
    let stamina = 10;
    let exhausted = false;
    let hidden = false;
    let activeHide: HideSpot | null = null;
    let nearestHide: HideSpot | null = null;
    let elapsed = 0;
    let lastHudUpdate = 0;
    let running = false;
    let moving = false;
    let aiMode: "chase" | "search" | "roam" = "chase";
    let aiTimer = 0;
    const aiTarget = PLAYER_START.clone();
    const clock = new THREE.Clock();
    const playerDirection = new THREE.Vector3();
    const oniDirection = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();

    const circleBlocked = (x: number, z: number, radius: number) => {
      if (x < -11.3 || x > 11.3 || z < -108.5 || z > 114) return true;
      return colliders.some(
        (box) =>
          x + radius > box.minX &&
          x - radius < box.maxX &&
          z + radius > box.minZ &&
          z - radius < box.maxZ,
      );
    };

    const segmentHitsBox = (a: THREE.Vector3, b: THREE.Vector3, box: Collider) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      let tMin = 0;
      let tMax = 1;
      const axes: Array<[number, number, number, number]> = [
        [a.x, dx, box.minX, box.maxX],
        [a.z, dz, box.minZ, box.maxZ],
      ];
      for (const axis of axes) {
        const start = axis[0];
        const delta = axis[1];
        const min = axis[2];
        const max = axis[3];
        if (Math.abs(delta) < 0.0001) {
          if (start < min || start > max) return false;
        } else {
          let t1 = (min - start) / delta;
          let t2 = (max - start) / delta;
          if (t1 > t2) {
            const swap = t1;
            t1 = t2;
            t2 = swap;
          }
          tMin = Math.max(tMin, t1);
          tMax = Math.min(tMax, t2);
          if (tMin > tMax) return false;
        }
      }
      return true;
    };

    const hasSight = () => {
      if (hidden) return false;
      const distance = oni.position.distanceTo(player.position);
      if (distance > (running ? 48 : 39)) return false;
      if (running && distance < 24) return true;
      return !colliders.some((box) => segmentHitsBox(oni.position, player.position, box));
    };

    const setCharacterOpacity = (group: THREE.Group, opacity: number) => {
      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          material.transparent = opacity < 1;
          material.opacity = opacity;
          material.depthWrite = opacity >= 1;
        });
      });
    };

    const reset = () => {
      player.position.copy(PLAYER_START);
      oni.position.copy(ONI_START);
      player.rotation.set(0, 0, 0);
      oni.rotation.set(0, 0, 0);
      setCharacterOpacity(player, 1);
      stamina = 10;
      exhausted = false;
      hidden = false;
      activeHide = null;
      nearestHide = null;
      elapsed = 0;
      aiMode = "chase";
      aiTimer = 0;
      aiTarget.copy(player.position);
      clearInput();
      camera.position.set(10.5, 15.8, 108);
      setHud(INITIAL_HUD);
    };

    const interact = () => {
      if (phaseRef.current !== "playing") return;
      if (hidden && activeHide) {
        hidden = false;
        setCharacterOpacity(player, 1);
        player.position.x = Math.sign(activeHide.position.x) * 7.05;
        activeHide = null;
        return;
      }
      if (!nearestHide) return;
      activeHide = nearestHide;
      hidden = true;
      player.position.copy(activeHide.position);
      setCharacterOpacity(player, 0.18);
      aiMode = "search";
      aiTimer = 7.5;
      aiTarget.set((Math.random() - 0.5) * 4, 0, player.position.z - 7);
    };

    gameApi.current = {
      start: () => {
        reset();
        changePhase("playing");
      },
      interact,
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      if (event.code === "KeyE" && !event.repeat) interact();
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearInput);
    window.addEventListener("pointercancel", clearInput);
    document.addEventListener("visibilitychange", clearInput);

    const updatePlayer = (delta: number, time: number) => {
      const controls = mobile.current;
      const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) + controls.y;
      const back = keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0;
      const left = keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0;
      const right = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) + controls.x;
      const wantsDash = keys.has("ShiftLeft") || keys.has("ShiftRight") || controls.dash;
      camera.getWorldDirection(cameraForward);
      cameraForward.y = 0;
      if (cameraForward.lengthSq() < 0.001) cameraForward.set(0, 0, -1);
      cameraForward.normalize();
      cameraRight.set(-cameraForward.z, 0, cameraForward.x);
      playerDirection
        .set(0, 0, 0)
        .addScaledVector(cameraForward, forward - back)
        .addScaledVector(cameraRight, right - left);
      moving = playerDirection.lengthSq() > 0 && !hidden;
      if (moving) playerDirection.normalize();
      running = moving && wantsDash && !exhausted && stamina > 0;

      if (running) {
        stamina = Math.max(0, stamina - delta);
        if (stamina <= 0.001) exhausted = true;
      } else if (stamina < 10) {
        stamina = Math.min(10, stamina + delta * (10 / 15));
        if (exhausted && stamina >= 9.999) exhausted = false;
      }

      if (moving) {
        const speed = running ? 8.4 : 4.45;
        const nx = player.position.x + playerDirection.x * speed * delta;
        const nz = player.position.z + playerDirection.z * speed * delta;
        if (!circleBlocked(nx, player.position.z, 0.48)) player.position.x = nx;
        if (!circleBlocked(player.position.x, nz, 0.48)) player.position.z = nz;
        player.rotation.y = Math.atan2(-playerDirection.x, -playerDirection.z);
      }

      const cadence = running ? 15 : moving ? 9 : 0;
      const swing = cadence ? Math.sin(time * cadence) * (running ? 0.62 : 0.34) : 0;
      const data = player.userData as Record<string, THREE.Mesh>;
      data.leftLeg.rotation.x = swing;
      data.rightLeg.rotation.x = -swing;
      data.leftArm.rotation.x = -swing * 0.72;
      data.rightArm.rotation.x = swing * 0.72;
      data.bag.rotation.z = swing * 0.12;
      player.position.y = moving ? Math.abs(Math.sin(time * cadence)) * 0.045 : 0;
    };

    const moveOni = (delta: number, time: number) => {
      const seesPlayer = hasSight();
      const oniDistance = oni.position.distanceTo(player.position);
      if (seesPlayer) {
        aiMode = "chase";
        aiTarget.copy(player.position);
        aiTimer = 5.5;
      } else if (aiMode === "chase") {
        aiMode = "search";
        aiTimer = 7;
        aiTarget.set(Math.max(-6, Math.min(6, player.position.x)), 0, player.position.z - 4);
      } else if (aiMode === "search") {
        aiTimer -= delta;
        if (aiTimer <= 0) {
          aiMode = "roam";
          aiTarget.set((Math.random() - 0.5) * 7, 0, Math.min(107, oni.position.z + 22));
        } else if (oni.position.distanceTo(aiTarget) < 1.3) {
          aiTarget.set(
            (Math.random() - 0.5) * 8,
            0,
            Math.max(-101, Math.min(106, oni.position.z + (Math.random() - 0.25) * 15)),
          );
        }
      } else if (oni.position.distanceTo(aiTarget) < 1.5) {
        aiTarget.set(
          (Math.random() - 0.5) * 7,
          0,
          Math.max(-101, Math.min(108, oni.position.z + (Math.random() - 0.25) * 24)),
        );
      }

      oniDirection.subVectors(aiTarget, oni.position);
      oniDirection.y = 0;
      if (oniDirection.lengthSq() > 0.05) {
        oniDirection.normalize();
        const baseSpeed = aiMode === "chase" ? 5.18 + (oniDistance > 25 ? 0.35 : 0) : aiMode === "search" ? 3.75 : 2.75;
        const speed = baseSpeed * (elapsed < START_GRACE_SECONDS ? 0.55 : 1);
        const nx = oni.position.x + oniDirection.x * speed * delta;
        const nz = oni.position.z + oniDirection.z * speed * delta;
        if (!circleBlocked(nx, oni.position.z, 0.68)) oni.position.x = nx;
        else {
          const sidestep = oni.position.x + (oni.position.x > 0 ? -1 : 1) * speed * delta;
          if (!circleBlocked(sidestep, oni.position.z, 0.68)) oni.position.x = sidestep;
        }
        if (!circleBlocked(oni.position.x, nz, 0.68)) oni.position.z = nz;
        oni.rotation.y = Math.atan2(-oniDirection.x, -oniDirection.z);
      }

      const data = oni.userData as Record<string, THREE.Mesh>;
      const pace = aiMode === "chase" ? 12 : 7;
      const swing = Math.sin(time * pace) * (aiMode === "chase" ? 0.66 : 0.38);
      data.leftLeg.rotation.x = swing;
      data.rightLeg.rotation.x = -swing;
      data.leftArm.rotation.x = -swing * 0.72;
      data.rightArm.rotation.x = swing * 0.72;
      data.head.rotation.y = Math.sin(time * 2.2) * 0.14;
      oni.position.y = Math.abs(Math.sin(time * pace)) * 0.06;
    };

    const updateWorld = (delta: number, time: number) => {
      updatePlayer(delta, time);
      moveOni(delta, time);
      elapsed += delta;
      nearestHide = null;
      let nearestDistance = Infinity;
      for (const [index, spot] of hideSpots.entries()) {
        const distance = player.position.distanceTo(spot.position);
        spot.ring.rotation.z = time * (index % 2 === 0 ? 0.34 : -0.34);
        (spot.ring.material as THREE.MeshBasicMaterial).opacity = 0.44 + Math.sin(time * 2.4 + index) * 0.22;
        if (!hidden && distance < 2.35 && distance < nearestDistance) {
          nearestDistance = distance;
          nearestHide = spot;
        }
      }
      const nextHide = hideSpots
        .filter((spot) => spot.position.z < player.position.z + 1)
        .sort((a, b) => b.position.z - a.position.z)[0];

      const oniDistance = oni.position.distanceTo(player.position);
      const homeDistance = player.position.distanceTo(HOME);
      if (oniDistance < (hidden ? 1.7 : 1.45)) {
        changePhase("caught");
        keys.clear();
      } else if (homeDistance < 3.35) {
        changePhase("won");
        keys.clear();
      }

      if (time - lastHudUpdate > 0.09) {
        lastHudUpdate = time;
        setHud({
          stamina: stamina * 10,
          staminaSeconds: Math.max(0, Math.ceil(stamina)),
          recoverySeconds: exhausted ? Math.max(0, Math.ceil((10 - stamina) / (10 / 15))) : 0,
          distance: Math.max(0, Math.round(homeDistance * 1.42)),
          oniDistance: Math.max(0, Math.round(oniDistance * 1.42)),
          danger: Math.max(0, Math.min(1, 1 - (oniDistance - 3) / 29)),
          hidden,
          exhausted,
          nearHide: Boolean(nearestHide) || hidden,
          hideLabel: hidden ? activeHide?.label || "隠れ場所" : nearestHide?.label || "",
          nextHideLabel: nextHide?.label || "",
          nextHideDistance: nextHide ? Math.max(0, Math.round(player.position.distanceTo(nextHide.position) * 1.42)) : 0,
          nextHideSide: nextHide ? (nextHide.position.x < player.position.x ? "左側" : "右側") : "",
          aiLabel: aiMode === "chase" ? "見つかってる" : aiMode === "search" ? "捜索中" : "見失った",
          elapsed,
        });
      }
    };

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      if (phaseRef.current === "playing") updateWorld(delta, time);

      const dangerShake =
        phaseRef.current === "playing" ? Math.max(0, 1 - oni.position.distanceTo(player.position) / 16) : 0;
      desiredCamera.set(player.position.x + 10.5, player.position.y + 15.8, player.position.z + 13.4);
      desiredCamera.x += Math.sin(time * 31) * dangerShake * 0.13;
      desiredCamera.y += Math.cos(time * 27) * dangerShake * 0.08;
      camera.position.lerp(desiredCamera, 1 - Math.pow(0.002, delta));
      lookTarget.set(player.position.x, 1.1, player.position.z - 5.8);
      camera.lookAt(lookTarget);
      stationLight.intensity = 14 * (0.92 + Math.sin(time * 7.3) * 0.08);
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearInput);
      window.removeEventListener("pointercancel", clearInput);
      document.removeEventListener("visibilitychange", clearInput);
      gameApi.current = null;
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
        if (object instanceof THREE.Mesh) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          const candidate = material as THREE.Material & { map?: THREE.Texture };
          candidate.map?.dispose();
          material.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [changePhase]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const emptySchema = {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
    const assertEmptyInput = (input: unknown) => {
      if (
        input === null ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input as Record<string, unknown>).length > 0
      ) {
        throw new Error("This action accepts an empty object only.");
      }
    };
    const tools: WebMcpTool[] = [
      {
        name: "start_escape_game",
        title: "Start escape game",
        description: "Start or restart the visible escape game from the station exit.",
        inputSchema: emptySchema,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          assertEmptyInput(input);
          gameApi.current?.start();
          return { phase: "playing", objective: "reach_home" };
        },
      },
      {
        name: "read_escape_status",
        title: "Read escape status",
        description: "Read the current visible game phase, distance, stamina, hiding state, and pursuit state.",
        inputSchema: emptySchema,
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input) {
          assertEmptyInput(input);
          const current = statusRef.current;
          return {
            phase: current.phase,
            distance_meters: current.hud.distance,
            stamina_percent: Math.round(current.hud.stamina),
            hidden: current.hud.hidden,
            pursuer_state: current.hud.aiLabel,
          };
        },
      },
    ];
    tools.forEach((tool) => {
      try {
        void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
      } catch {
        // Unsupported implementations should not interrupt the game.
      }
    });
    return () => lifecycle.abort();
  }, []);

  const setMobile = (key: "dash", value: boolean) => {
    mobile.current[key] = value;
  };
  const pressHandlers = (key: "dash") => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setMobile(key, true);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setMobile(key, false);
    },
    onPointerCancel: () => setMobile(key, false),
  });
  const updateStick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    const max = Math.max(1, radius - 18);
    const magnitude = Math.min(1, length / max);
    if (magnitude <= 0.14) {
      mobile.current.x = 0;
      mobile.current.y = 0;
      const knob = event.currentTarget.querySelector<HTMLElement>(".touch-stick-knob");
      if (knob) knob.style.transform = "translate(-50%, -50%)";
      return;
    }
    const adjusted = (magnitude - 0.14) / 0.86;
    mobile.current.x = (dx / Math.max(1, length)) * adjusted;
    mobile.current.y = (-dy / Math.max(1, length)) * adjusted;
    const knob = event.currentTarget.querySelector<HTMLElement>(".touch-stick-knob");
    if (knob) {
      knob.style.transform = `translate(calc(-50% + ${mobile.current.x * 40}px), calc(-50% - ${mobile.current.y * 40}px))`;
    }
  };
  const resetStick = (event?: React.PointerEvent<HTMLDivElement>) => {
    mobile.current.x = 0;
    mobile.current.y = 0;
    const knob = event?.currentTarget.querySelector<HTMLElement>(".touch-stick-knob");
    if (knob) knob.style.transform = "translate(-50%, -50%)";
  };
  const stickHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      updateStick(event);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) updateStick(event);
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      resetStick(event);
    },
    onPointerCancel: resetStick,
  };

  const result = phase === "won" || phase === "caught" ? resultCopy(phase) : null;

  return (
    <main className="game-shell">
      <div ref={mountRef} className="game-canvas" />
      <div className="game-grain" aria-hidden="true" />
      <div className="danger-vignette" style={{ opacity: Math.min(0.82, hud.danger * 0.8) }} aria-hidden="true" />

      {phase === "playing" && (
        <div className="hud-layer">
          <header className="hud-top">
            <div className="objective-panel">
              <div className="objective-icon"><House size={20} strokeWidth={1.8} /></div>
              <div><span className="micro-label">目的地</span><strong>自宅まで {hud.distance}m</strong></div>
            </div>
            <div className="route-panel" aria-label={"経過時間 " + formatTime(hud.elapsed)}>
              <span>烏森駅</span>
              <div className="route-line"><i style={{ width: Math.max(2, 100 - (hud.distance / 284) * 100) + "%" }} /></div>
              <span>自宅</span>
              <b>{formatTime(hud.elapsed)}</b>
            </div>
            <div className={"threat-panel " + (hud.danger > 0.68 ? "is-close" : "")}>
              <span className="micro-label">鬼との距離</span>
              <strong>{hud.oniDistance}m</strong><em>{hud.aiLabel}</em>
            </div>
          </header>

          <aside className="stamina-panel">
            <div className="stamina-heading">
              <span><Zap size={17} />走れる時間</span>
              <b>{hud.exhausted ? "あと" + hud.recoverySeconds + "秒" : hud.staminaSeconds + "秒"}</b>
            </div>
            <Progress value={hud.stamina} className={"stamina-track " + (hud.exhausted ? "is-exhausted" : "")} />
            <p>{hud.exhausted ? "息が戻るまで走れない" : "SHIFTで走る・使い切ると15秒休憩"}</p>
          </aside>

          {hud.nearHide && (
            <button className="hide-prompt" onClick={() => gameApi.current?.interact()} type="button">
              <EyeOff size={19} />
              <span><b>{hud.hidden ? "外に出る" : "隠れる"}</b>{hud.hideLabel}</span>
              <kbd>E</kbd>
            </button>
          )}
          {!hud.nearHide && hud.nextHideLabel && (
            <div className="hide-guide" role="status">
              <EyeOff size={16} />
              <span><small>次の死角</small><b>{hud.nextHideLabel}</b></span>
              <em>{hud.nextHideDistance}m・{hud.nextHideSide}</em>
            </div>
          )}
          {hud.hidden && <div className="hidden-state" role="status"><EyeOff size={18} /> 潜伏中　鬼が離れるのを待て</div>}
          <div className="desktop-help" aria-label="操作方法">
            <span><kbd>WASD</kbd> 移動</span><span><kbd>SHIFT</kbd> 走る</span><span><kbd>E</kbd> 隠れる</span>
          </div>
          <div className="touch-controls" aria-label="タッチ操作">
            <div className="touch-stick" role="application" aria-label="移動スティック" {...stickHandlers}>
              <span className="touch-stick-ring" aria-hidden="true" />
              <span className="touch-stick-knob" aria-hidden="true" />
            </div>
            <div className="touch-actions">
              {hud.nearHide && <button type="button" onClick={() => gameApi.current?.interact()} className="touch-hide"><EyeOff size={20} />{hud.hidden ? "出る" : "隠れる"}</button>}
              <button type="button" className="touch-dash" {...pressHandlers("dash")}><Footprints size={22} />走る</button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={phase === "intro"}>
        <DialogContent showCloseButton={false} className="game-dialog intro-dialog" aria-describedby="intro-description">
          <DialogHeader>
            <div className="dialog-kicker"><span />23:48　烏森駅・東口</div>
            <DialogTitle className="game-title">帰宅鬼ごっこ<small>終電の影</small></DialogTitle>
            <DialogDescription id="intro-description" className="game-description">
              改札を抜けた瞬間、背後で足音が止まった。<br />
              振り返ると、こちらを見ている等身大の鬼。<br /><b>……あれ、なんかヤバい。</b>
            </DialogDescription>
          </DialogHeader>
          <div className="mission-card">
            <div><House size={21} /><span><small>GOAL</small>自宅まで逃げ切る</span></div>
            <div><Footprints size={21} /><span><small>RULE</small>走れるのは10秒</span></div>
            <div><EyeOff size={21} /><span><small>HINT</small>街の5か所に隠れる</span></div>
          </div>
          <Button className="start-button" onClick={() => gameApi.current?.start()} size="lg"><LogOut size={19} /> 駅を出る</Button>
          <p className="dialog-note"><Route size={15} /> 推奨：PCはWASD、スマホは画面ボタン</p>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(result)}>
        {result && (
          <DialogContent showCloseButton={false} className={"game-dialog result-dialog " + phase} aria-describedby="result-description">
            <DialogHeader>
              <div className="dialog-kicker"><span />{result.eyebrow}</div>
              <DialogTitle className="result-title">{result.title}</DialogTitle>
              <DialogDescription id="result-description" className="game-description">{result.body}</DialogDescription>
            </DialogHeader>
            <div className="result-stats">
              <div><small>TIME</small><b>{formatTime(hud.elapsed)}</b></div>
              <div><small>DISTANCE</small><b>{phase === "won" ? "0m" : "残り " + hud.distance + "m"}</b></div>
            </div>
            <Button className="start-button" onClick={() => gameApi.current?.start()} size="lg">{result.action}</Button>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}
