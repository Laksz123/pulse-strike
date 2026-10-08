/**
 * Whatever is in the player's hands: guns, the crossbow, tools and medicine.
 * The view model lives in its own small scene drawn on top of the world, so it never pokes through
 * walls and keeps the same size at any field of view.
 */

import { RAPIER } from "../physics";
import * as THREE from "three";
import { skillOf, useStore } from "../store";
import { sfx } from "./audio";
import { box } from "./build";
import type { Game } from "./game";
import { ITEMS, type Item, type ItemDef } from "./items";
import { PX, SKIN, heldModel, sleeveColors, type Held } from "./models";
import { WEAPON_BY_ID, statsOf, type WeaponDef, type WeaponStats } from "./weapons";

const BASE_FOV = 75;
const HIP = new THREE.Vector3(0.2, -0.2, -0.6);
const TOOL = new THREE.Vector3(0.24, -0.3, -0.5);
const SMALL = new THREE.Vector3(0.16, -0.19, -0.46);
const Z = new THREE.Vector3(0, 0, 1);

interface Bolt {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  dmg: number;
  head: number;
  life: number;
  stuck: boolean;
}

function arm(parent: THREE.Object3D, hand: [number, number, number], toward: [number, number, number], sleeve: number, cuff: number): void {
  const from = new THREE.Vector3(...hand);
  const dir = new THREE.Vector3(...toward).normalize();
  const g = new THREE.Group();
  g.position.copy(from);
  g.quaternion.setFromUnitVectors(Z, dir);
  box(g, 4.4, 4.4, 5, 0, 0, 1.5, SKIN);
  box(g, 4.6, 1.2, 2, 0, 1.9, -1, SKIN);
  box(g, 5.2, 5.2, 3, 0, 0, 5.5, cuff);
  box(g, 4.8, 4.8, 44, 0, 0, 29, sleeve);
  g.traverse((o) => (o.castShadow = false));
  parent.add(g);
}

export class Hands {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
  ads = false;

  private root = new THREE.Group();
  private held: Held | null = null;
  private item: Item | null = null;
  private def: ItemDef | null = null;
  private gun: WeaponDef | null = null;
  private stats: WeaponStats | null = null;
  private chest: string | null = null;
  /** Rounds left in each gun's magazine, by uid. */
  private mags = new Map<string, number>();
  private flash: THREE.Mesh;
  private light = new THREE.PointLight(0xffc27a, 0, 16, 2);
  private bolts: Bolt[] = [];
  private boltGeo = new THREE.BoxGeometry(0.03, 0.03, 0.62);
  private boltMat = new THREE.MeshLambertMaterial({ color: 0xa87444 });

  private cooldown = 0;
  private reloadT = 0;
  private recoil = 0;
  private flashT = 0;
  private swapT = 0;
  private adsT = 0;
  /** Tool swing progress in seconds; < 0 when idle. */
  private swingT = -1;
  private swingHit = false;
  private useT = -1;

  private f = new THREE.Vector3();
  private r = new THREE.Vector3();
  private u = new THREE.Vector3();
  private origin = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor(private game: Game) {
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x9a8466, 1.9));
    const sun = new THREE.DirectionalLight(0xffe6c2, 1.6);
    sun.position.set(1.5, 3, 1);
    this.scene.add(sun);
    this.flash = new THREE.Mesh(
      new THREE.BoxGeometry(5, 5, 7),
      new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.95 }),
    );
    this.flash.visible = false;
    this.flash.position.z = -4;
    game.camera.add(this.light);
    this.light.position.set(0.2, -0.1, -1);
    this.sync();
  }

  /** Follow the store: the held item changes with the hotbar, pickups and the inventory. */
  private sync(): void {
    const s = useStore.getState();
    const item = s.hot[s.active] ?? null;
    const chest = s.armor[1]?.id ?? null;
    if ((item?.uid ?? null) === (this.item?.uid ?? null) && item?.rarity === this.item?.rarity && chest === this.chest) {
      this.item = item;
      return;
    }
    if (this.held) this.root.remove(this.held.group);
    if (useStore.getState().channel) useStore.setState({ channel: null });
    this.held = null;
    this.item = item;
    this.chest = chest;
    this.def = item ? ITEMS[item.id] : null;
    this.gun = item ? (WEAPON_BY_ID[item.id] ?? null) : null;
    this.stats = item && this.gun ? statsOf(item) : null;
    this.reloadT = 0;
    this.swingT = -1;
    this.useT = -1;
    this.swapT = 0.3;
    if (item) {
      const held = heldModel(item.id, item.rarity ?? 0);
      held.group.scale.setScalar(PX);
      const [sleeve, cuff] = sleeveColors(chest);
      arm(held.group, held.right, [5, -13, 20], sleeve, cuff);
      if (held.left) arm(held.group, held.left, [-16, -13, 10], sleeve, cuff);
      held.muzzle.add(this.flash);
      this.root.add(held.group);
      this.held = held;
      if (this.gun && this.stats && !this.mags.has(item.uid)) this.mags.set(item.uid, this.stats.mag);
    }
    useStore.setState({ mag: item && this.gun ? this.mags.get(item.uid)! : 0, reloading: false });
  }

  private mag(): number {
    return this.item ? (this.mags.get(this.item.uid) ?? 0) : 0;
  }

  reload(): void {
    if (!this.item || !this.gun || !this.stats || this.reloadT > 0) return;
    if (this.mag() >= this.stats.mag || useStore.getState().ammo[this.gun.ammo] <= 0) return;
    this.reloadT = this.stats.reload * (1 - skillOf("gunner") * 0.02);
    sfx.reload();
    useStore.setState({ reloading: true });
  }

  private finishReload(): void {
    if (!this.item || !this.gun || !this.stats) return;
    const s = useStore.getState();
    const mag = this.mag();
    const take = Math.min(this.stats.mag - mag, s.ammo[this.gun.ammo]);
    this.mags.set(this.item.uid, mag + take);
    useStore.setState({ ammo: { ...s.ammo, [this.gun.ammo]: s.ammo[this.gun.ammo] - take }, mag: mag + take, reloading: false });
  }

  /** Aim basis and eye position for this frame. */
  private aim(): void {
    const cam = this.game.camera;
    cam.updateMatrixWorld();
    cam.matrixWorld.extractBasis(this.r, this.u, this.f);
    this.f.negate();
    this.game.player.eye(this.origin);
  }

  /** The muzzle in world space: the view model sits in camera space of its own scene. */
  private muzzleWorld(): THREE.Vector3 {
    if (!this.held) return this.origin.clone();
    this.root.updateMatrixWorld(true);
    return this.held.muzzle.getWorldPosition(new THREE.Vector3()).applyMatrix4(this.game.camera.matrixWorld);
  }

  private fire(): void {
    const { item, gun, stats, game } = this;
    if (!item || !gun || !stats) return;
    const mag = this.mag();
    this.mags.set(item.uid, mag - 1);
    useStore.setState({ mag: mag - 1 });
    this.cooldown = gun.projectile ? 0.25 : 60 / stats.rpm;
    sfx.shot(gun.cls);
    this.aim();
    const from = this.muzzleWorld();
    const moving = game.player.speed > 2 ? 1.5 : 1;
    const spread = stats.spread * (this.ads ? 0.35 : 1) * moving * (game.player.grounded ? 1 : 2);

    let hitAny = false;
    let killed = false;
    for (let i = 0; i < stats.pellets; i++) {
      const a = Math.random() * Math.PI * 2;
      const m = spread * Math.sqrt(Math.random());
      const dir = this.tmp.copy(this.f).addScaledVector(this.r, Math.cos(a) * m).addScaledVector(this.u, Math.sin(a) * m).normalize();
      if (gun.projectile) {
        this.launch(from, dir, stats);
        continue;
      }
      const hit = game.world.castRayAndGetNormal(new RAPIER.Ray(this.origin, dir), 420, true, undefined, undefined, game.player.collider);
      const dist = hit ? hit.timeOfImpact : 220;
      const end = this.origin.clone().addScaledVector(dir, dist);
      if (hit) {
        const target = game.targets.get(hit.collider.handle);
        if (target) {
          killed = target.onHit(stats.dmg * (dist > stats.range ? 0.5 : 1), stats.head, end, dir) || killed;
          hitAny = true;
        } else {
          game.fx.impact(end, new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), game.surfaceColor(hit.collider.handle), 4);
        }
      }
      game.fx.tracer(from, end);
    }
    if (hitAny) this.confirm(killed);

    const rec = stats.recoil * (this.ads ? 0.7 : 1) * (1 - skillOf("gunner") * 0.03);
    game.player.kick += rec;
    game.player.yaw += (Math.random() - 0.5) * rec * 0.5;
    this.recoil = Math.min(1, this.recoil + 0.5 + stats.recoil * 6);
    if (!gun.projectile) {
      this.flashT = 0.05;
      game.enemies.alert(this.origin, 55);
    } else game.enemies.alert(this.origin, 8);
  }

  private confirm(killed: boolean): void {
    sfx.hit();
    const now = performance.now();
    useStore.setState(killed ? { hitAt: now, killAt: now } : { hitAt: now });
    if (killed) sfx.kill();
  }

  private launch(from: THREE.Vector3, dir: THREE.Vector3, stats: WeaponStats): void {
    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
    mesh.position.copy(from);
    this.game.scene.add(mesh);
    this.bolts.push({ mesh, vel: dir.clone().multiplyScalar(78), dmg: stats.dmg, head: stats.head, life: 4, stuck: false });
  }

  private updateBolts(dt: number): void {
    const game = this.game;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) {
        game.scene.remove(b.mesh);
        this.bolts.splice(i, 1);
        continue;
      }
      if (b.stuck) continue;
      b.vel.y -= 9.8 * dt;
      const step = b.vel.length() * dt;
      const dir = this.tmp.copy(b.vel).normalize();
      const hit = game.world.castRayAndGetNormal(new RAPIER.Ray(b.mesh.position, dir), step, true, undefined, undefined, game.player.collider);
      if (hit) {
        const end = b.mesh.position.clone().addScaledVector(dir, hit.timeOfImpact);
        const target = game.targets.get(hit.collider.handle);
        if (target) {
          this.confirm(target.onHit(b.dmg, b.head, end, dir));
          game.scene.remove(b.mesh);
          this.bolts.splice(i, 1);
          continue;
        }
        game.fx.impact(end, new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), game.surfaceColor(hit.collider.handle), 3);
        b.mesh.position.copy(end).addScaledVector(dir, -0.22);
        b.stuck = true;
        b.life = 12;
      } else b.mesh.position.addScaledVector(dir, step);
      b.mesh.quaternion.setFromUnitVectors(Z, dir);
    }
  }

  /** One blow of a tool: harvest a node, hurt an enemy, or thud into the scenery. */
  private strike(): void {
    const tool = this.def?.tool;
    if (!tool) return;
    const game = this.game;
    this.aim();
    const hit = game.world.castRayAndGetNormal(new RAPIER.Ray(this.origin, this.f), tool.motor ? 2.5 : 2.8, true, undefined, undefined, game.player.collider);
    if (!hit) return;
    const point = this.origin.clone().addScaledVector(this.f, hit.timeOfImpact);
    const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    if (game.harvest.hit(hit.collider.handle, tool, point, normal)) return;
    const target = game.targets.get(hit.collider.handle);
    if (target) {
      this.confirm(target.onHit(tool.melee, 1, point, this.f));
      return;
    }
    game.fx.impact(point, normal, game.surfaceColor(hit.collider.handle), 3);
    if (!tool.motor) sfx.thud();
  }

  private updateTool(dt: number, trigger: boolean): void {
    const tool = this.def!.tool!;
    if (tool.motor) {
      if (trigger && this.cooldown <= 0 && this.swapT <= 0) {
        this.cooldown = tool.interval;
        this.strike();
        this.game.enemies.alert(this.origin, 40);
        this.recoil = 0.6;
      }
      return;
    }
    if (this.swingT < 0) {
      if (trigger && this.swapT <= 0) {
        this.swingT = 0;
        this.swingHit = false;
        sfx.swing();
      }
      return;
    }
    // A practised hand swings faster.
    this.swingT += dt * (skillOf(tool.type === "axe" ? "lumber" : "miner") >= 5 && tool.type !== "rock" ? 1.15 : 1);
    if (!this.swingHit && this.swingT >= tool.interval * 0.4) {
      this.swingHit = true;
      this.strike();
    }
    if (this.swingT >= tool.interval) this.swingT = -1;
  }

  private updateMed(dt: number, trigger: boolean): void {
    const med = this.def!.med!;
    const s = useStore.getState();
    if (!trigger || this.swapT > 0) {
      if (this.useT >= 0) {
        this.useT = -1;
        useStore.setState({ channel: null });
      }
      return;
    }
    if (this.useT < 0) {
      if (this.game.player.hp >= this.game.player.maxHp) {
        if (this.game.input.firePressed) s.toast("Здоровье полное", "#cdbb8f");
        return;
      }
      this.useT = 0;
    }
    this.useT += dt * (skillOf("survivor") >= 5 ? 1.25 : 1);
    useStore.setState({ channel: { label: this.def!.name, p: this.useT / med.time } });
    if (this.useT >= med.time) {
      this.useT = -1;
      this.game.player.heal(med.heal);
      s.consumeAt({ c: "hot", i: s.active });
      s.gain("heal", "здоровья", med.heal, "#5fbf5a");
      sfx.heal();
      useStore.setState({ channel: null });
    }
  }

  /** `blocked`: the player is in a menu or a minigame and cannot act. */
  update(dt: number, blocked: boolean): void {
    this.sync();
    const input = this.game.input;
    const player = this.game.player;
    const trigger = input.fire && !blocked;
    this.cooldown -= dt;
    this.swapT = Math.max(0, this.swapT - dt);
    this.ads = !!this.gun && input.ads && !blocked && this.reloadT <= 0 && !player.sprinting;

    if (this.item && this.gun && this.stats) {
      if (this.reloadT > 0) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) this.finishReload();
      } else if (this.swapT <= 0 && this.cooldown <= 0 && (this.gun.auto ? trigger : trigger && input.firePressed)) {
        if (this.mag() > 0) this.fire();
        else if (useStore.getState().ammo[this.gun.ammo] > 0) this.reload();
        else {
          sfx.empty();
          useStore.getState().toast("Нет патронов", "#f0a35c");
        }
      }
      // An empty crossbow reloads itself, like a bolt-action.
      if (this.gun.projectile && this.mag() === 0 && this.reloadT <= 0 && this.cooldown <= 0) this.reload();
    } else if (this.def?.tool) this.updateTool(dt, trigger);
    else if (this.def?.med) this.updateMed(dt, trigger);
    this.updateBolts(dt);

    // View model pose.
    const held = this.held;
    if (held) {
      const loaded = this.mag() > 0 && this.reloadT <= 0;
      if (held.bolt) held.bolt.visible = loaded;
      if (held.cocked) held.cocked.visible = loaded;
      if (held.slack) held.slack.visible = !loaded;
    }
    this.adsT += ((this.ads ? 1 : 0) - this.adsT) * (1 - Math.exp(-16 * dt));
    this.recoil *= Math.exp(-14 * dt);
    const bob = Math.min(1, player.speed / 5) * (this.ads ? 0.15 : 1);
    const reloadDip = this.reloadT > 0 && this.stats ? Math.sin((1 - this.reloadT / this.stats.reload) * Math.PI) : 0;
    const swapDip = this.swapT / 0.3;
    const tool = this.def?.tool;
    const base = this.gun || tool?.motor ? HIP : tool ? TOOL : SMALL;
    const sightY = this.gun?.projectile ? 5.2 : this.gun?.cls === "sniper" ? 8.4 : 7.4;
    this.tmp.set(0, -sightY * PX, -0.46);
    this.root.position.copy(base).lerp(this.tmp, this.adsT);
    this.root.position.x += Math.cos(player.bob) * 0.012 * bob;
    this.root.position.y += Math.abs(Math.sin(player.bob)) * -0.014 * bob - reloadDip * 0.16 - swapDip * 0.25;
    this.root.position.z += this.recoil * 0.06;
    let rx = this.recoil * 0.09 - reloadDip * 0.7 - swapDip * 0.6 + (this.gun ? 0.05 * (1 - this.adsT) : 0);
    let ry = (player.sprinting ? 0.35 : 0) + (this.gun ? 0.1 * (1 - this.adsT) : 0);
    let rz = reloadDip * 0.3;
    if (tool && !tool.motor) {
      // Rest: handle leaning forward and inward. Swing: wind up, chop down, recover.
      let swing = 0;
      if (this.swingT >= 0) {
        const p = this.swingT / tool.interval;
        swing = p < 0.22 ? (p / 0.22) * 0.55 : p < 0.42 ? 0.55 - ((p - 0.22) / 0.2) * 1.75 : -1.2 * (1 - (p - 0.42) / 0.58) ** 2;
      }
      rx += -0.42 + swing;
      rz += 0.2;
      ry += 0.12;
      this.root.position.z += swing * 0.07;
      this.root.position.y += Math.min(0, swing) * 0.06;
    } else if (tool?.motor) {
      this.root.position.x += (Math.random() - 0.5) * 0.004 * (trigger ? 3 : 1);
      this.root.position.y += (Math.random() - 0.5) * 0.004 * (trigger ? 3 : 1);
    } else if (this.def?.med) {
      const p = this.useT >= 0 ? Math.min(1, this.useT / 0.3) : 0;
      this.root.position.x -= p * 0.12;
      this.root.position.y += p * 0.05;
      rx += p * 0.5;
      rz += p * 0.6;
    }
    this.root.rotation.set(rx, ry, rz);

    this.flashT -= dt;
    const on = this.flashT > 0;
    this.flash.visible = on;
    this.light.intensity = on ? 22 : 0;
    if (on) this.flash.rotation.z = Math.random() * 6;

    const fov = this.ads ? (this.gun?.cls === "sniper" ? 24 : this.gun?.projectile ? 50 : 56) : player.sprinting ? 80 : BASE_FOV;
    const cam = this.game.camera;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * (1 - Math.exp(-14 * dt));
      cam.updateProjectionMatrix();
    }
    if (useStore.getState().ads !== this.ads) useStore.setState({ ads: this.ads });
  }

  /** Mouse sensitivity drops while aiming, so the zoomed view is as easy to steer. */
  sensitivity(): number {
    return 0.0022 * useStore.getState().settings.sens * (this.game.camera.fov / BASE_FOV);
  }
}
