import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { threeAccess } from '../input/threeAccess';

/**
 * Publishes the live camera and canvas element to `threeAccess` so the
 * DOM-level PointerControls can raycast. Renders nothing.
 */
export function ThreeBridge() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    threeAccess.camera = camera;
    threeAccess.canvas = gl.domElement;
    return () => {
      threeAccess.camera = null;
      threeAccess.canvas = null;
    };
  }, [camera, gl]);

  return null;
}
