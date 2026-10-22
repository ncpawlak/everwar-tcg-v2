import { describe, it, expect } from 'vitest';
import type { Card, CardId } from '../state/types';
import { onSentAbilities, onSentAbilityFor, pileActivatedAbilityFor, pileHasActivatable } from './pile';

function hero(id: string, abilities: string[]): Card {
  return {
    id: id as CardId,
    type: 'A',
    name: id,
    abilities,
  } as unknown as Card;
}

const SALVAGE = 'Salvage Beacon: When this Hero is sent to the Graveyard: draw 1 card.';
const FIELD_CACHE = 'Field Cache: While this Hero is in your Replen pile, you can: return it to your Hand.';

describe('P8 pile abilities', () => {
  it('onSentAbilityFor matches only the correct pile', () => {
    const c = hero('h1', [SALVAGE]);
    expect(onSentAbilityFor(c, 'graveyard')?.ir.name).toBe('Salvage Beacon');
    expect(onSentAbilityFor(c, 'replen')).toBeNull();
  });

  it('onSentAbilities collects triggers among just-sent cards in order', () => {
    const a = hero('a', [SALVAGE]);
    const b = hero('b', []);
    const c = hero('c', [SALVAGE]);
    const cardsById = { a, b, c } as Record<CardId, Card>;
    const hits = onSentAbilities(['a', 'b', 'c'] as CardId[], 'graveyard', cardsById);
    expect(hits.map((h) => h.cardId)).toEqual(['a', 'c']);
  });

  it('pileActivatedAbilityFor matches only the correct pile', () => {
    const c = hero('h2', [FIELD_CACHE]);
    expect(pileActivatedAbilityFor(c, 'replen')?.ir.name).toBe('Field Cache');
    expect(pileActivatedAbilityFor(c, 'graveyard')).toBeNull();
  });

  it('pileHasActivatable is true only when a matching card sits in the pile', () => {
    const withAbility = hero('h3', [FIELD_CACHE]);
    const plain = hero('h4', []);
    const cardsById = { h3: withAbility, h4: plain } as Record<CardId, Card>;
    expect(pileHasActivatable(['h4'] as CardId[], 'replen', cardsById)).toBe(false);
    expect(pileHasActivatable(['h3', 'h4'] as CardId[], 'replen', cardsById)).toBe(true);
    // Wrong pile: Field Cache activates from Replen, not the Graveyard.
    expect(pileHasActivatable(['h3'] as CardId[], 'graveyard', cardsById)).toBe(false);
  });
});
