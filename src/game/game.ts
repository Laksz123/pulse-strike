/** One mission: owns the renderer, the physics world, the island and the frame loop. */

import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { skillOf, useStore, type Summary, type Tab } from "../store";
import { sfx } from "./audio";
import { bake, solidShape, type SolidKind } from "./build";
import { Enemies } from "./enemies";
import { Fx } from "./fx";
import { Hands } from "./hands";
import { Harvest, groupVisual, type NodeKind } from "./harvest";
import type { ResId } from "./items";
import { CONTAINER_NAMES, rollContainer, type ContainerKind, type Drop } from "./loot";
import { buildMonument } from "./monuments";
import { Player } from "./player";
import { TreeField, buildFerns } from "./trees";
import {
  FOG_COLOR, MONUMENTS, buildBoulder, buildClouds, buildContainer, buildFiber, buildScrapPile, buildSky, buildTerrain, buildWater,
  generateLayout, heightAt, monumentPoint, nearestMonument, pickSpawn,
} from "./world";

export interface Target {
  /** Returns true when the hit killed the target. */
  onHit(dmg: number, headMult: number, point: THREE.Vector3, dir: THREE.Vector3): boolean;
}

interface Interactable {
  pos: THREE.Vector3;
  label(): string;
  /** Seconds F must be held; 0 = a single press. */
  hold(): number;
  use(): void;
  done: boolean;
  /** Holding it makes noise that draws enemies. */
  noisy?: () => boolean;
}

interface Container {
  kind: ContainerKind;
  relic: boolean;
  group: THREE.Group;
  opened: boolean;
  /** What is still inside after a visit with a full backpack. */
  loot: Drop[] | null;
  it: Interactable;
}

interface LockState {
  c: Container;
  pins: number;
  done: number;
  angle: number;
  dir: number;
  base: number;
  zoneA: number;
  sizes: number[];
  okAt: number;
  badAt: number;
}

export interface Input {
  keys: Set<string>;
  fire: boolean;
  /** True for the one frame the trigger went down. */
  firePressed: boolean;
  ads: boolean;
}

const SAND = 0xcfa96e;
const TAU = Math.PI * 2;
/** Seconds of standing still it takes to be picked up. */
const EVAC_TIME = 10;

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 2000);
  readonly world: RAPIER.World;
  readonly fx: Fx;
  readonly player: Player;
  readonly hands: Hands;
  readonly enemies: Enemies;
  readonly harvest: Harvest;
  readonly targets = new Map<number, Target>();
  readonly input: Input = { keys: new Set(), fire: false, firePressed: false, ads: false };
  time = 0;

  private canvas = document.createElement("canvas");
  private renderer: THREE.WebGLRenderer;
  private sun = new THREE.DirectionalLight(0xfff0d2, 2.2);
  private clouds!: THREE.Group;
  private water!: THREE.Mesh;
  private interactables: Interactable[] = [];
  private current: Interactable | null = null;
  private channel: { it: Interactable; t: number; dur: number; noise: number } | null = null;
  private lockState: LockState | null = null;
  /** Seconds into the evacuation countdown, or -1. */
  private evac = -1;
  private inZone = false;
  private startXp = 0;
  private surface = new Map<number, number>();
  private raf = 0;
  private last = 0;
  private hudT = 0;
  private craftT = 0;
  private dead = false;
  /** Debug and automated checks: run without pointer lock. */
  private noLock = new URLSearchParams(location.search).has("nolock");
  private cleanup: (() => void)[] = [];

  static async create(host: HTMLElement): Promise<Game> {
    await RAPIER.init();
    return new Game(host);
  }

  /** Every mission gets its own canvas: a WebGL context cannot be reused once it has been released. */
  private constructor(host: HTMLElement) {
    host.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !useStore.getState().settings.pixel, powerPreference: "high-performance" });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.background = new THREE.Color(FOG_COLOR);
    this.scene.fog = new THREE.Fog(FOG_COLOR, 150, 720);
    this.scene.add(this.camera, buildSky());
    this.scene.add(new THREE.HemisphereLight(0xe4f2fa, 0x9aa878, 1.75));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -75;
    sc.right = sc.top = 75;
    sc.near = 1;
    sc.far = 420;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun, this.sun.target);

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.fx = new Fx(this.scene);
    this.enemies = new Enemies(this);
    this.harvest = new Harvest(this);
    const spawn = this.buildLevel();
    useStore.getState().deploy();
    this.startXp = useStore.getState().xp;
    this.player = new Player(this, spawn.x, spawn.z);
    this.hands = new Hands(this);
    this.world.step();

    this.bindInput();
    this.resize();
    this.cleanup.push(useStore.subscribe((s, prev) => s.settings.pixel !== prev.settings.pixel && this.resize()));
    useStore.setState({ paused: !this.noLock });
    useStore.getState().toast("Ты в джунглях. M — карта, H — завершить миссию", "#cdbb8f");
    (window as unknown as { __game?: Game }).__game = this;
  }

  // -------------------------------------------------------------------------------------------
  // Level

  /** Gives every solid mesh under `root` a static collider. */
  addSolids(root: THREE.Object3D): RAPIER.Collider[] {
    root.updateMatrixWorld(true);
    const out: RAPIER.Collider[] = [];
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    root.traverse((o) => {
      const kind = o.userData.solid as SolidKind | undefined;
      if (!kind) return;
      const mesh = o as THREE.Mesh;
      mesh.matrixWorld.decompose(p, q, s);
      const shape = solidShape(mesh, s);
      const desc =
        kind === "box"
          ? RAPIER.ColliderDesc.cuboid(shape.hx, shape.hy, shape.hz)
          : kind === "cyl"
            ? RAPIER.ColliderDesc.cylinder(shape.hy, shape.r)
            : RAPIER.ColliderDesc.ball(shape.r);
      const c = this.world.createCollider(desc.setTranslation(p.x, p.y, p.z).setRotation(q));
      const m = mesh.material as THREE.MeshLambertMaterial;
      // Debris takes the colour of what was hit; textured surfaces use the tint, toned down.
      this.surface.set(c.handle, m.map ? m.color.clone().multiplyScalar(0.6).getHex() : m.color.getHex());
      out.push(c);
    });
    return out;
  }

  surfaceColor(handle: number): number {
    return this.surface.get(handle) ?? SAND;
  }

  /** Puts a prop on the ground, gives it colliders and merges its meshes. */
  private place(obj: THREE.Object3D, x: number, z: number, sink = 0): RAPIER.Collider[] {
    obj.position.set(x, heightAt(x, z) - sink, z);
    this.scene.add(obj);
    const colliders = this.addSolids(obj);
    bake(obj);
    return colliders;
  }

  private addNode(kind: NodeKind, group: THREE.Group, x: number, z: number, sink: number): void {
    const colliders = this.place(group, x, z, sink);
    // Low props do not need to cast shadows: that halves their draw calls.
    group.traverse((o) => (o.castShadow = false));
    this.harvest.add(kind, groupVisual(group, this.scene), colliders);
  }

  private addContainer(kind: ContainerKind, group: THREE.Group, relic = false): void {
    const pos = group.getWorldPosition(new THREE.Vector3());
    pos.y += 0.6;
    const name = relic ? "Реликварий" : CONTAINER_NAMES[kind];
    const picks = () => useStore.getState().countItem("lockpick");
    const c: Container = { kind, relic, group, opened: false, loot: null, it: null as unknown as Interactable };
    c.it = {
      pos,
      done: false,
      label: () => {
        if (c.opened) return "Забрать остатки";
        if (kind === "barrel") return "Обыскать бочку";
        if (picks() > 0) return `Взломать: ${name} · отмычек ${picks()}`;
        return kind === "chest" ? "Выломать сундук (долго и шумно)" : `${name}: нужны отмычки`;
      },
      hold: () => (c.opened ? 0.5 : kind === "barrel" ? 1.1 : picks() > 0 ? 0 : kind === "chest" ? 7 : 0),
      noisy: () => !c.opened && kind === "chest" && picks() === 0,
      use: () => {
        if (c.opened || kind === "barrel") return this.openContainer(c);
        if (picks() > 0) return this.startLock(c);
        if (kind === "chest") {
          this.enemies.alert(pos, 70);
          return this.openContainer(c);
        }
        useStore.getState().toast("Нужны отмычки: 2 металлолома в крафте", "#f0a35c");
      },
    };
    this.interactables.push(c.it);
  }

  private openContainer(c: Container): void {
    const s = useStore.getState();
    if (!c.loot) {
      c.loot = rollContainer(c.kind, c.relic);
      s.addXp(c.kind === "barrel" ? 5 : c.kind === "chest" ? 25 : 70);
      s.skillXp("thief", c.kind === "barrel" ? 2 : c.kind === "chest" ? 12 : 30);
      s.event(`open:${c.kind}`);
    }
    if (!c.opened) {
      c.opened = true;
      c.group.traverse((o) => {
        if (o.name === "lid") {
          o.rotation.z = 0.9;
          o.position.x += 0.35;
          o.position.y += 0.1;
        } else if (o.name === "lid2") o.visible = false;
      });
      const best = Math.max(-1, ...c.loot.map((d) => (d.kind === "item" ? (d.item.rarity ?? -1) : -1)));
      if (best >= 3 || c.relic) sfx.rare();
      else sfx.open();
    }
    c.loot = s.give(c.loot);
    if (c.loot.length) s.toast("Рюкзак полон: часть добычи осталась", "#f0a35c");
    else c.it.done = true;
  }

  private addBarrel(x: number, z: number): void {
    const barrel = buildContainer(Math.random, "barrel");
    this.place(barrel, x, z, 0.08);
    this.addContainer("barrel", barrel);
  }

  private buildLevel(): { x: number; z: number } {
    const terrain = buildTerrain();
    this.scene.add(terrain.mesh);
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(terrain.vertices, terrain.indices));
    this.water = buildWater();
    this.scene.add(this.water);

    const { layout, rng } = generateLayout();
    this.clouds = buildClouds(rng);
    this.scene.add(this.clouds);

    // The five monuments: buildings, loot, guards.
    for (const m of MONUMENTS) {
      const built = buildMonument(m.id);
      built.group.position.set(m.x, m.pad, m.z);
      built.group.rotation.y = m.yaw;
      this.scene.add(built.group);
      this.addSolids(built.group);
      bake(built.group);
      for (const c of built.containers) this.addContainer(c.kind, c.group, c.relic);
      for (const b of built.barrels) {
        const p = monumentPoint(m, b.x, b.z);
        this.addBarrel(p.x, p.z);
      }
      for (const n of built.nodes) {
        const p = monumentPoint(m, n.x, n.z);
        this.addNode(n.kind, n.kind === "scrap" ? buildScrapPile(rng) : buildBoulder(rng, n.kind), p.x, p.z, 0.1);
      }
      for (const guard of built.guards) {
        const p = monumentPoint(m, guard.x, guard.z);
        this.enemies.addSpawn({ species: guard.boss ? "boss" : "human", x: p.x, z: p.z, y: guard.y, danger: guard.danger ?? m.tier, elite: guard.elite, post: m });
      }
    }

    // The forest: instanced for drawing, but every tree is its own harvest node.
    const forest = new TreeField();
    const ids = layout.trees.map((t) => forest.add(t));
    forest.build(this.scene);
    layout.trees.forEach((t, i) => {
      const model = forest.model(ids[i]);
      const w = (model.w * t.scale) / 2 + 0.06;
      const h = (model.h * t.scale) / 2;
      const lean = model.lean * t.scale;
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(w, h, w)
          .setTranslation(t.x + Math.cos(t.yaw) * lean, t.y + h, t.z - Math.sin(t.yaw) * lean)
          .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw)),
      );
      this.surface.set(collider.handle, 0x8a6a45);
      this.harvest.add("tree", forest.visual(ids[i]), [collider], Math.round(model.hp * t.scale));
    });
    buildFerns(this.scene, layout.ferns);

    for (const r of layout.rocks) this.addNode("rock", buildBoulder(rng, "rock"), r.x, r.z, 0.12);
    for (const r of layout.ores) this.addNode("ore", buildBoulder(rng, "ore"), r.x, r.z, 0.12);
    for (const r of layout.crystals) this.addNode("crystal", buildBoulder(rng, "crystal"), r.x, r.z, 0.12);
    for (const b of layout.barrels) this.addBarrel(b.x, b.z);

    for (const f of layout.fibers) {
      const plant = buildFiber(rng);
      this.place(plant, f.x, f.z, 0.02);
      plant.traverse((o) => (o.castShadow = false));
      const it: Interactable = {
        pos: plant.position.clone().setY(plant.position.y + 0.5),
        done: false,
        label: () => "Собрать волокно",
        hold: () => 0.5,
        use: () => {
          it.done = true;
          this.scene.remove(plant);
          sfx.pickup();
          useStore.getState().give([{ kind: "res", res: "cloth", n: 2 + Math.floor(Math.random() * 2) }]);
        },
      };
      this.interactables.push(it);
    }

    for (const a of layout.animals) this.enemies.addSpawn({ species: a.kind, x: a.x, z: a.z, danger: a.danger });
    return pickSpawn(layout);
  }

  // -------------------------------------------------------------------------------------------
  // Lockpicking: stop the needle inside the sweet spot once per pin.

  private startLock(c: Container): void {
    const hard = c.kind === "military";
    const skill = skillOf("thief");
    const wide = 1 + skill * 0.04;
    this.lockState = {
      c, pins: hard ? 5 : 3, done: 0, angle: Math.random() * TAU, dir: 1, base: (hard ? 3.3 : 2.5) * (skill >= 5 ? 0.85 : 1),
      zoneA: Math.random() * TAU, sizes: (hard ? [0.7, 0.6, 0.5, 0.42, 0.36] : [0.9, 0.72, 0.56]).map((s) => s * wide), okAt: 0, badAt: 0,
    };
    this.releaseInput();
    this.publishLock();
  }

  private publishLock(): void {
    const l = this.lockState;
    if (!l) return useStore.setState({ lock: null });
    useStore.setState({
      lock: {
        name: l.c.relic ? "Реликварий" : CONTAINER_NAMES[l.c.kind], pins: l.pins, done: l.done, angle: l.angle, zoneA: l.zoneA,
        zoneSize: l.sizes[l.done] ?? 0.4, picks: useStore.getState().countItem("lockpick"), okAt: l.okAt, badAt: l.badAt,
      },
    });
  }

  private lockPress(): void {
    const l = this.lockState;
    if (!l) return;
    const size = l.sizes[l.done];
    const mid = l.zoneA + size / 2;
    const off = Math.atan2(Math.sin(l.angle - mid), Math.cos(l.angle - mid));
    const s = useStore.getState();
    if (Math.abs(off) <= size / 2) {
      l.done++;
      l.okAt = performance.now();
      sfx.pin(l.done);
      s.skillXp("thief", 3);
      if (l.done >= l.pins) {
        this.lockState = null;
        this.publishLock();
        s.addXp(l.pins * 6);
        return this.openContainer(l.c);
      }
    } else {
      // A master lockpicker sometimes saves the pick.
      if (!(skillOf("thief") >= 10 && Math.random() < 0.3)) s.consumeItem("lockpick", 1);
      l.badAt = performance.now();
      l.done = Math.max(0, l.done - 1);
      sfx.snap();
      this.enemies.alert(l.c.it.pos, 18);
      if (s.countItem("lockpick") === 0) {
        this.lockState = null;
        this.publishLock();
        return s.toast("Отмычки сломаны", "#f0a35c");
      }
    }
    l.zoneA = Math.random() * TAU;
    l.dir = -l.dir;
  }

  private cancelLock(): void {
    if (!this.lockState) return;
    this.lockState = null;
    this.publishLock();
  }

  // -------------------------------------------------------------------------------------------
  // Finishing the mission

  /** Starts (or cancels) the evacuation countdown. It only works away from the monuments. */
  startEvac(): void {
    if (this.dead) return;
    if (this.evac >= 0) return this.cancelEvac("Эвакуация отменена");
    const p = this.player.pos;
    const near = nearestMonument(p.x, p.z);
    if (near.edge < 25) return useStore.getState().toast(`Из РТ не эвакуируют: отойди от «${near.m.name}»`, "#f0a35c");
    this.stopChannel();
    this.cancelLock();
    this.evac = 0;
    useStore.getState().toast("Эвакуация: стой на месте 10 секунд", "#5fbf5a");
  }

  private cancelEvac(why?: string): void {
    if (this.evac < 0) return;
    this.evac = -1;
    useStore.setState({ channel: null });
    if (why) useStore.getState().toast(why, "#f0a35c");
  }

  private summary(survived: boolean): Summary {
    const s = useStore.getState();
    const res: Partial<Record<ResId, number>> = {};
    for (const k of Object.keys(s.res) as ResId[]) if (s.res[k] > s.banked.res[k]) res[k] = s.res[k] - s.banked.res[k];
    return {
      survived, minutes: Math.max(1, Math.round(this.time / 60)), kills: s.kills, salt: Math.max(0, s.salt - s.banked.salt), res,
      items: [...s.hot, ...s.bag].filter((it) => it && !it.starter).length, xp: s.xp - this.startXp,
    };
  }

  private finish(survived: boolean): void {
    this.dead = true;
    this.releaseInput();
    this.cancelLock();
    if (document.pointerLockElement) document.exitPointerLock();
    const s = useStore.getState();
    const summary = this.summary(survived);
    if (survived) s.extract(summary);
    else s.die(summary);
    s.setScreen(survived ? "summary" : "dead");
  }

  // -------------------------------------------------------------------------------------------
  // Input

  private get locked(): boolean {
    return this.noLock || document.pointerLockElement === this.canvas;
  }

  /** The player cannot act: a menu or a minigame has the controls. */
  private get busy(): boolean {
    return useStore.getState().panel === "inv" || !!this.lockState;
  }

  private bindInput(): void {
    const on = <K extends keyof DocumentEventMap>(target: Document | Window | HTMLElement, type: K, fn: (e: DocumentEventMap[K]) => void) => {
      target.addEventListener(type, fn as EventListener);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener));
    };
    on(window, "keydown", (e) => {
      const s = useStore.getState();
      if (s.screen !== "game" || this.dead) return;
      if (e.code === "Tab" || e.code === "KeyE") {
        e.preventDefault();
        if (!e.repeat) this.toggleInventory();
        return;
      }
      if (e.code === "Escape" && s.panel === "inv") return this.lock();
      if (!this.locked || e.repeat || s.panel === "inv") return;
      if (e.code === "Space") e.preventDefault();
      if (this.lockState) {
        if (e.code === "KeyF" || e.code === "Space") this.lockPress();
        else if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) this.cancelLock();
        return;
      }
      this.input.keys.add(e.code);
      if (e.code === "KeyM" || e.code === "KeyG") useStore.setState({ panel: s.panel === "map" ? null : "map" });
      if (e.code === "KeyF") this.interact();
      if (e.code === "KeyH") this.startEvac();
      if (e.code === "KeyR") this.hands.reload();
      if (e.code === "KeyQ") this.cycle(1);
      const digit = /^Digit([1-6])$/.exec(e.code);
      if (digit) useStore.getState().setActive(Number(digit[1]) - 1);
    });
    on(window, "keyup", (e) => {
      this.input.keys.delete(e.code);
      if (e.code === "KeyF") this.stopChannel();
    });
    on(window, "blur" as keyof DocumentEventMap, () => this.releaseInput());
    on(document, "mousemove", (e) => {
      if (!this.locked || this.busy || this.dead) return;
      // Browsers occasionally report one huge jump when the pointer is captured; drop it.
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.player.look(e.movementX, e.movementY, this.hands.sensitivity());
    });
    on(this.canvas, "mousedown", (e) => {
      sfx.unlock();
      if (!this.locked) return this.lock();
      if (this.lockState) return this.lockPress();
      if (e.button === 0) {
        this.input.fire = true;
        this.input.firePressed = true;
      } else if (e.button === 2) this.input.ads = true;
    });
    on(window, "mouseup" as keyof DocumentEventMap, (e) => {
      const b = (e as MouseEvent).button;
      if (b === 0) this.input.fire = false;
      else if (b === 2) this.input.ads = false;
    });
    on(this.canvas, "contextmenu", (e) => e.preventDefault());
    on(this.canvas, "wheel", (e) => {
      if (this.locked && !this.busy) this.cycle(e.deltaY > 0 ? 1 : -1);
    });
    on(document, "pointerlockchange", () => {
      const paused = !this.locked && useStore.getState().panel !== "inv";
      if (!this.locked) this.releaseInput();
      useStore.setState({ paused });
    });
    on(window, "resize" as keyof DocumentEventMap, () => this.resize());
  }

  /** Scroll the hotbar to the next slot that holds something. */
  private cycle(dir: number): void {
    const s = useStore.getState();
    for (let i = 1; i <= s.hot.length; i++) {
      const n = (s.active + dir * i + s.hot.length * 2) % s.hot.length;
      if (s.hot[n]) return s.setActive(n);
    }
  }

  private releaseInput(): void {
    this.input.keys.clear();
    this.input.fire = false;
    this.input.ads = false;
    this.stopChannel();
  }

  lock(): void {
    if (this.dead) return;
    sfx.unlock();
    if (useStore.getState().panel === "inv") useStore.setState({ panel: null });
    if (this.noLock) return;
    // Browsers refuse a new lock for about a second after Esc: fall back to the pause overlay.
    void Promise.resolve(this.canvas.requestPointerLock()).catch(() => {});
    setTimeout(() => {
      if (!this.locked && !this.dead && useStore.getState().panel !== "inv") useStore.setState({ paused: true });
    }, 400);
  }

  openInventory(tab?: Tab): void {
    this.releaseInput();
    this.cancelLock();
    useStore.setState(tab ? { panel: "inv", tab } : { panel: "inv" });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private toggleInventory(): void {
    if (useStore.getState().panel === "inv") this.lock();
    else this.openInventory("craft");
  }

  private interact(): void {
    const it = this.current;
    if (!it || it.done || this.evac >= 0) return;
    const hold = it.hold();
    if (hold <= 0) return it.use();
    this.channel = { it, t: 0, dur: hold, noise: 0 };
  }

  private stopChannel(): void {
    if (!this.channel) return;
    this.channel = null;
    useStore.setState({ channel: null });
  }

  private resize(): void {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    // Pixel mode: one rendered pixel covers 2–4 screen pixels, for a chunky retro picture.
    const pixel = useStore.getState().settings.pixel;
    const k = pixel ? 1 / Math.max(2, Math.round(h / 400)) : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(Math.round(w * k), Math.round(h * k), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.hands.camera.aspect = w / h;
    this.hands.camera.updateProjectionMatrix();
  }

  // -------------------------------------------------------------------------------------------
  // Loop

  private render(): void {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.hands.scene, this.hands.camera);
  }

  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.dead && (this.locked || useStore.getState().panel === "inv")) this.update(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Advance the simulation by hand: used by automated checks when the tab is not animating. */
  tick(seconds: number): void {
    for (let t = 0; t < seconds && !this.dead; t += 1 / 60) this.update(1 / 60);
    this.render();
  }

  private update(dt: number): void {
    this.time += dt;
    const busy = this.busy;
    this.player.update(dt, this.hands.ads, busy);
    this.world.step();
    this.hands.update(dt, busy || useStore.getState().panel === "map" || !!this.channel || this.evac >= 0);
    this.enemies.update(dt);
    this.harvest.update(dt);
    this.fx.update(dt);
    this.input.firePressed = false;

    const p = this.player.pos;
    this.sun.target.position.set(p.x, p.y, p.z);
    this.sun.position.set(p.x + 90, p.y + 130, p.z + 55);
    this.clouds.position.x = ((this.time * 2.5) % 600) - 300;
    const waves = (this.water.material as THREE.MeshLambertMaterial).map!;
    waves.offset.set(this.time * 0.006, Math.sin(this.time * 0.3) * 0.004);

    if (this.lockState) {
      const l = this.lockState;
      l.angle = (l.angle + l.dir * l.base * (1 + l.done * 0.2) * dt + TAU) % TAU;
      if (Math.hypot(l.c.it.pos.x - p.x, l.c.it.pos.z - p.z) > 4) this.cancelLock();
      else this.publishLock();
    }

    if (this.evac >= 0) {
      if (this.player.speed > 0.8) this.cancelEvac("Эвакуация сорвана: нужно стоять на месте");
      else {
        this.evac += dt;
        useStore.setState({ channel: { label: `Эвакуация · ${Math.ceil(EVAC_TIME - this.evac)} с`, p: this.evac / EVAC_TIME } });
        if (this.evac >= EVAC_TIME) return this.finish(true);
      }
    }

    // What is the player looking at?
    const fx = -Math.sin(this.player.yaw);
    const fz = -Math.cos(this.player.yaw);
    let best: Interactable | null = null;
    let bestD = 3.2;
    for (const it of this.interactables) {
      if (it.done) continue;
      const dx = it.pos.x - p.x;
      const dz = it.pos.z - p.z;
      if (Math.abs(dx) > 4 || Math.abs(dz) > 4 || Math.abs(it.pos.y - p.y) > 3) continue;
      const d = Math.hypot(dx, dz);
      if (d < bestD && (d < 1 || (dx * fx + dz * fz) / d > 0.55)) {
        best = it;
        bestD = d;
      }
    }
    this.current = best;

    if (this.channel) {
      const ch = this.channel;
      if (ch.it !== best || ch.it.done) this.stopChannel();
      else {
        ch.t += dt;
        ch.noise += dt;
        if (ch.it.noisy?.() && ch.noise > 0.9) {
          ch.noise = 0;
          sfx.thud();
          this.enemies.alert(ch.it.pos, 60);
        }
        if (ch.t >= ch.dur) {
          this.stopChannel();
          ch.it.use();
        } else useStore.setState({ channel: { label: ch.it.label(), p: ch.t / ch.dur } });
      }
    }

    this.craftT += dt;
    if (this.craftT >= 0.1) {
      useStore.getState().tickCraft(this.craftT);
      this.craftT = 0;
    }

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      const s = useStore.getState();
      const near = nearestMonument(p.x, p.z);
      const inside = near.edge < 0;
      if (inside && !this.inZone) s.toast(`РТ «${near.m.name}»: здесь стреляют`, "#f0a35c");
      this.inZone = inside;
      const prompt =
        best && !this.channel && !this.lockState && this.evac < 0 ? (best.hold() > 0 ? `Удерживай F · ${best.label()}` : `F · ${best.label()}`) : null;
      useStore.setState({
        zone: { name: near.m.name, dist: Math.max(0, Math.round(near.edge)), inside, tier: near.m.tier },
        prompt, px: p.x, pz: p.z, yaw: this.player.yaw,
      });
    }
  }

  onPlayerHurt(): void {
    this.cancelLock();
    this.stopChannel();
    this.cancelEvac("Эвакуация сорвана: тебя ранили");
  }

  onPlayerDeath(): void {
    this.finish(false);
  }

  /** Give up from the pause menu: the same as dying. */
  abandon(): void {
    if (!this.dead) this.finish(false);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    for (const fn of this.cleanup) fn();
    if (document.pointerLockElement) document.exitPointerLock();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.world.free();
  }
}
