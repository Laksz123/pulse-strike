/**
 * The physics engine, fetched when it is first needed instead of with the page. It is by far the
 * heaviest thing the game has — three quarters of all its code — and the lobby does not use it, so
 * the menu is on screen long before it has arrived. It is asked for as soon as the menu is up.
 */

import type Rapier from "@dimforge/rapier3d-compat";

/** The engine. Empty until `loadPhysics()` has resolved; everything that touches it waits for that first. */
export let RAPIER: typeof Rapier = undefined as unknown as typeof Rapier;

/** The engine's types under the same name, so code reads `RAPIER.World` whether it means the class or the type. */
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace RAPIER {
  export type World = Rapier.World;
  export type Collider = Rapier.Collider;
  export type ColliderDesc = Rapier.ColliderDesc;
  export type Ray = Rapier.Ray;
  export type Vector = Rapier.Vector;
  export type KinematicCharacterController = Rapier.KinematicCharacterController;
}

let loading: Promise<void> | null = null;

/** Fetches and starts the engine once; later calls wait for, or return at once after, the first. */
export function loadPhysics(): Promise<void> {
  return (loading ??= import("@dimforge/rapier3d-compat").then(async (m) => {
    await m.default.init();
    RAPIER = m.default;
  }));
}
