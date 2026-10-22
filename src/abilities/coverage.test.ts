import { describe, it, expect } from 'vitest';
import { HERO_LIBRARY, EQUIPMENT_LIBRARY } from '../state/cardData';
import { parseAbility } from './parseAbility';

/**
 * Parse-coverage harness for the v3 ability grammar. Enumerates every rules-text
 * line carried by a Hero or Equipment card in the catalog, parses it, and tracks
 * how many still fall through to an `unimplemented` IR node.
 *
 * As parser rules are added, raise `MAX_UNIMPLEMENTED` to lock in the gain and
 * prevent regressions. The list of still-unparsed lines is printed so the next
 * slice can see exactly what remains.
 */

/** Every unique ability line authored on a Hero or Equipment card. */
function catalogAbilityLines(): string[] {
  const lines = new Set<string>();
  for (const h of HERO_LIBRARY) for (const a of h.abilities ?? []) lines.add(a);
  for (const e of EQUIPMENT_LIBRARY) for (const a of e.abilities ?? []) lines.add(a);
  return [...lines];
}

describe('P8 v3 ability parse-coverage', () => {
  // Ratchet DOWN as rules are added. Current baseline is measured, not aspirational.
  const MAX_UNIMPLEMENTED = 53;

  it('reports how much of the catalog the parser structures', () => {
    const lines = catalogAbilityLines();
    const unimplemented = lines.filter((t) => parseAbility(t).trigger === 'unimplemented');
    const covered = lines.length - unimplemented.length;
    // eslint-disable-next-line no-console
    console.log(
      `\n[ability coverage] ${covered}/${lines.length} parsed ` +
        `(${unimplemented.length} unimplemented)\n` +
        unimplemented.map((t) => '  · ' + t).join('\n'),
    );
    expect(unimplemented.length).toBeLessThanOrEqual(MAX_UNIMPLEMENTED);
  });

  it('always assigns a name and preserves raw text (never throws)', () => {
    for (const t of catalogAbilityLines()) {
      const ir = parseAbility(t);
      expect(ir.raw).toBe(t);
      expect(typeof ir.name).toBe('string');
    }
  });
});
