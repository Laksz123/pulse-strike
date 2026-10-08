/**
 * Harvest nodes: trees, boulders, ore, crystals and scrap piles.
 *
 * Every hit moves a glowing weak point to a new spot on the node. Striking it doubles the yield and
 * builds a combo, so careful aiming farms faster than blind swinging, a better tool farms faster
 * than both, and the Lumberjack and Miner professions add to everything.
 */

import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { skillOf, useStore } from "../store";
import { sfx } from "./audio";
import type { Game } from "./game";
import type { ResId, ToolDef } from "./items";
import { sprite } from "./textures";

export type NodeKind = "tree" | "rock" | "ore" | "crystal" | "scrap";

/** How a node shows what happens to it, whether it is its own group or an instance in a forest. */
export interface NodeVisual {
  /** Base of the node on the ground. */
  pos: THREE.Vector3;
  radius: number;
  /** Shrinks the node to this fraction as it is mined out. */
  shrink(f: number): void;
  wobble(): void;
  /** Leans the node over by `angle` around `axis`. */
  fall(axis: THREE.Vector3, angle: number): void;
  remove(): void;
}

/** A node that is its own group in the scene. */
export function groupVisual(group: THREE.Group, scene: THREE.Scene): NodeVisual {
  const base = group.scale.x;
  return {
    pos: group.position,
    radius: (group.userData.radius as number) ?? 0.8,
    shrink: (f) => group.scale.setScalar(base * f),
    wobble: () => {},
    fall: (axis, angle) => group.quaternion.setFromAxisAngle(axis, angle),
    remove: () => scene.remove(group),
  };
}

interface NodeCfg {
  name: string;
  hp: number;
  /** Which specialised tool works at full power. */
  tool: "axe" | "pick";
  /** Resources per point of damage dealt. */
  res: [ResId, number][];
  /** Lowest pick tier that can break it. */
  minTier?: number;
  weakR: number;
  chips: number;
}

const NODES: Record<NodeKind, NodeCfg> = {
  tree: { name: "Дерево", hp: 10, tool: "axe", res: [["wood", 1]], weakR: 0.24, chips: 0x8a6a45 },
  rock: { name: "Валун", hp: 12, tool: "pick", res: [["stone", 1]], weakR: 0.3, chips: 0x9a9284 },
  ore: { name: "Железная руда", hp: 14, tool: "pick", res: [["ore", 1], ["stone", 0.25]], weakR: 0.3, chips: 0xd6783a },
  crystal: { name: "Кристаллы", hp: 8, tool: "pick", res: [["crystal", 0.25]], minTier: 2, weakR: 0.28, chips: 0x8fe9ff },
  scrap: { name: "Металлолом", hp: 8, tool: "pick", res: [["scrap", 1], ["elec", 0.08]], weakR: 0.3, chips: 0x94603a },
};

interface Node {
  kind: NodeKind;
  visual: NodeVisual;
  colliders: RAPIER.Collider[];
  handles: Set<number>;
  hp: number;
  max: number;
  /** Centre of the main collider: where weak points are aimed. */
  cx: number;
  cz: number;
  /** Fractions of a resource carried over to the next hit. */
  acc: Partial<Record<ResId, number>>;
  weak: THREE.Vector3 | null;
  combo: number;
  /** Seconds since it was felled; < 0 while standing. */
  fallT: number;
  fallAxis: THREE.Vector3;
}

export class Harvest {
  private byHandle = new Map<number, Node>();
  private falling: Node[] = [];
  private marker: THREE.Sprite;
  private active: Node | null = null;
  private idle = 0;
  private warned = 0;
  private taught = false;

  constructor(private game: Game) {
    const map = sprite(
      "weak",
      ["....o....", "...oYo...", "..o.Y.o..", ".o..Y..o.", "oYYYWYYYo", ".o..Y..o.", "..o.Y.o..", "...oYo...", "....o...."],
      { o: "#b3362a", Y: "#ffd24a", W: "#ffffff" },
    );
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, fog: false }));
    this.marker.visible = false;
    this.marker.renderOrder = 10;
    game.scene.add(this.marker);
  }

  /** `hp` overrides the default toughness (big trees take longer). */
  add(kind: NodeKind, visual: NodeVisual, colliders: RAPIER.Collider[], hp?: number): void {
    const at = colliders[0]?.translation() ?? visual.pos;
    const max = hp ?? NODES[kind].hp;
    const node: Node = {
      kind, visual, colliders, handles: new Set(colliders.map((c) => c.handle)), hp: max, max, cx: at.x, cz: at.z, acc: {}, weak: null,
      combo: 0, fallT: -1, fallAxis: new THREE.Vector3(1, 0, 0),
    };
    for (const c of colliders) this.byHandle.set(c.handle, node);
  }

  /** A tool struck collider `handle`. Returns false when it is not a harvest node. */
  hit(handle: number, tool: ToolDef, point: THREE.Vector3, normal: THREE.Vector3): boolean {
    const node = this.byHandle.get(handle);
    if (!node) return false;
    const cfg = NODES[node.kind];
    const s = useStore.getState();
    this.active = node;
    this.idle = 0;
    if (cfg.minTier && (tool.type !== "pick" || tool.tier < cfg.minTier)) {
      this.game.fx.impact(point, normal, 0xffffff, 3);
      sfx.thud();
      if (this.game.time - this.warned > 2) {
        this.warned = this.game.time;
        s.toast("Слишком твёрдо: нужна железная кирка", "#f0a35c");
      }
      useStore.setState({ node: { name: cfg.name, hp: node.hp / node.max, combo: 0, hint: "Нужна железная кирка" } });
      return true;
    }
    const tree = node.kind === "tree";
    const skill = skillOf(tree ? "lumber" : "miner");
    const right = tool.type === "rock" || tool.type === cfg.tool;
    const power = tool.power * (right ? 1 : 0.25);
    const weak = !tool.motor && !!node.weak && point.distanceTo(node.weak) < cfg.weakR;
    node.combo = weak ? node.combo + 1 : 0;
    let mult = tool.motor ? 1.3 : weak ? 2 + Math.min(node.combo - 1, 5) * 0.1 : 1;
    mult *= 1 + skill * 0.06;
    if (node.kind === "crystal" && skill >= 10) mult *= 1.25;
    const applied = Math.min(power, node.hp);
    node.hp -= applied;
    let gained = 0;
    for (const [res, per] of cfg.res) {
      const total = (node.acc[res] ?? 0) + applied * per * mult;
      const n = Math.floor(total);
      node.acc[res] = total - n;
      if (n > 0) {
        s.give([{ kind: "res", res, n }]);
        gained += res === "crystal" ? n * 10 : n;
      }
    }
    if (gained) s.skillXp(tree ? "lumber" : "miner", gained);
    this.game.fx.impact(point, normal, cfg.chips, weak ? 9 : 4);
    if (weak) {
      sfx.ding(Math.min(node.combo, 6));
      s.addXp(1);
    } else if (tool.motor) sfx.motor();
    else sfx.chop();

    if (node.hp <= 0.001) this.deplete(node);
    else {
      if (tree) node.visual.wobble();
      else node.visual.shrink(0.62 + 0.38 * (node.hp / node.max));
      if (!tool.motor) this.placeWeak(node);
      const hint = right ? null : `${cfg.tool === "axe" ? "Топор" : "Кирка"} добывает вчетверо быстрее`;
      useStore.setState({ node: { name: cfg.name, hp: node.hp / node.max, combo: node.combo, hint } });
    }
    return true;
  }

  /** Picks a new weak point on the side of the node that faces the player. */
  private placeWeak(node: Node): void {
    const eye = this.game.player.eye(new THREE.Vector3());
    const base = node.visual.pos.y;
    const target = new THREE.Vector3();
    for (let attempt = 0; attempt < 6; attempt++) {
      if (node.kind === "tree") target.set(node.cx, base + 0.6 + Math.random() * 1.3, node.cz);
      else {
        const r = node.visual.radius * 0.55 * (0.62 + 0.38 * (node.hp / node.max));
        target.set(node.cx + (Math.random() - 0.5) * 2 * r, base + 0.15 + Math.random() * r * 1.4, node.cz + (Math.random() - 0.5) * 2 * r);
      }
      const dir = target.sub(eye);
      const dist = dir.length();
      dir.multiplyScalar(1 / dist);
      const hit = this.game.world.castRay(new RAPIER.Ray(eye, dir), dist + 2, true, undefined, undefined, undefined, undefined, (c) => node.handles.has(c.handle));
      if (!hit) continue;
      const p = eye.clone().addScaledVector(dir, hit.timeOfImpact - 0.03);
      // Keep it reachable: not above the head, and away from the previous spot.
      if (p.y - eye.y > 0.5 || (node.weak && p.distanceTo(node.weak) < 0.25)) continue;
      node.weak = p;
      if (!this.taught) {
        this.taught = true;
        useStore.getState().toast("Бей по метке: двойная добыча и серия", "#ffd24a");
      }
      return;
    }
  }

  private deplete(node: Node): void {
    for (const c of node.colliders) {
      this.byHandle.delete(c.handle);
      this.game.world.removeCollider(c, false);
    }
    node.weak = null;
    this.active = null;
    this.marker.visible = false;
    const s = useStore.getState();
    useStore.setState({ node: null });
    s.addXp(node.kind === "crystal" ? 15 : 4);
    if (node.kind === "tree") {
      if (skillOf("lumber") >= 10) s.give([{ kind: "res", res: "cloth", n: 1 }]);
      const p = this.game.player.pos;
      const away = new THREE.Vector3(node.cx - p.x, 0, node.cz - p.z).normalize();
      node.fallAxis.set(away.z, 0, -away.x);
      node.fallT = 0;
      this.falling.push(node);
      sfx.fall();
    } else {
      const at = node.visual.pos.clone().setY(node.visual.pos.y + 0.4);
      this.game.fx.impact(at, new THREE.Vector3(0, 1, 0), NODES[node.kind].chips, 16);
      node.visual.remove();
      sfx.thud();
    }
  }

  update(dt: number): void {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const n = this.falling[i];
      n.fallT += dt;
      const t = Math.min(1, n.fallT / 1.1);
      n.visual.fall(n.fallAxis, t * t * 1.5);
      if (n.fallT > 2.4) {
        n.visual.remove();
        this.falling.splice(i, 1);
      }
    }
    const node = this.active;
    if (!node) return;
    this.idle += dt;
    const p = this.game.player.pos;
    const far = Math.hypot(node.cx - p.x, node.cz - p.z) > 5;
    if (this.idle > 6 || far) {
      this.active = null;
      node.weak = null;
      node.combo = 0;
      this.marker.visible = false;
      useStore.setState({ node: null });
      return;
    }
    this.marker.visible = !!node.weak;
    if (node.weak) {
      this.marker.position.copy(node.weak);
      const pulse = 0.26 + Math.sin(this.game.time * 9) * 0.03;
      this.marker.scale.set(pulse, pulse, 1);
    }
  }
}
