import { BOARD_Y } from '../board/boardConfig';

/** The playmat surface. Sits at the board plane and catches card shadows.
 * Centered on the board's mirror center (z ≈ -1.25) and enlarged so it spans
 * both the player's field and the mirrored opponent field. */
export function BoardView() {
  return (
    <mesh
      position={[0, BOARD_Y - 0.011, -1.25]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[11.5, 10.2]} />
      <meshStandardMaterial color="#16302a" roughness={0.9} metalness={0.0} />
    </mesh>
  );
}
