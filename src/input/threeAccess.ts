import type { Camera } from 'three';

/**
 * Bridge holding references to the live Three.js camera and the WebGL canvas
 * element. Populated by an in-canvas component (ThreeBridge) and read by the
 * DOM-level PointerControls so input can raycast without relying on R3F's own
 * event system (which is unreliable in some embedded runtimes).
 */
export const threeAccess: { camera: Camera | null; canvas: HTMLCanvasElement | null } = {
  camera: null,
  canvas: null,
};
