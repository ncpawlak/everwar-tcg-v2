/**
 * Phase 8 ability model + engine skeleton (Slice 1).
 *
 * Replaces the old flat `BAbility` enum with a structured, extensible record so
 * every future ability class (passive stat auras, activated once-per-turn,
 * when-destroyed / when-sent-to-replen triggers) shares one vocabulary. This
 * slice ships only the machine-readable operations the game already performs
 * (the four B-card on-set effects); later slices grow `EffectSpec` and the
 * timing executors without reshaping this envelope.
 *
 * Pure data + a pure dispatcher — no Three.js, no React, no store imports. The
 * store supplies the side-effecting callbacks through `EffectContext`.
 */

/** When an ability resolves within the turn/game lifecycle. */
export type AbilityTiming =
  | 'on-set' // fires the moment the card is Set (S1)
  | 'passive' // continuous while the card is on the field (S2)
  | 'activated' // manual, Main phase only, via the ability popup (S3)
  | 'when-destroyed' // fires as the card leaves the field to the graveyard (S5)
  | 'when-sent-to-replen'; // fires as the card is sent to the replen pile (S5)

/** Whether an ability fires on its own or must be triggered by the player. */
export type AbilityActivation = 'auto' | 'activated';

/**
 * A machine-readable operation an ability performs. Discriminated on `kind`.
 * Slice 1 ships only the two zone/deck operations the current B-cards use;
 * `statAura`, targeted effects, counters, etc. arrive in their own slices.
 */
export type EffectSpec =
  | { kind: 'draw'; count: number }
  | { kind: 'shuffleZoneIntoDeck'; zone: 'graveyard' | 'replen' };

/** A single structured ability. Cards may declare up to three. */
export interface Ability {
  /** Stable registry key (also the id stored on a card). */
  id: string;
  /** Short display name shown on the card and in the ability popup. */
  name: string;
  /** Full rules text. */
  text: string;
  timing: AbilityTiming;
  /** Auto abilities fire on their timing; activated ones need a player click. */
  activation: AbilityActivation;
  effect: EffectSpec;
  /** True when the ability may only resolve once per turn (S3). */
  oncePerTurn?: boolean;
}

/**
 * Side-effecting callbacks the store hands to the effect dispatcher. Keeping the
 * dispatcher pure (it only calls these) makes the ability engine unit-testable
 * without a live store.
 */
export interface EffectContext {
  draw: (count: number) => void;
  shuffleZoneIntoDeck: (zone: 'graveyard' | 'replen') => void;
}

/**
 * The ability registry. Cards reference abilities by id; UI and engine both read
 * from here so display labels and behavior can never drift apart. Slice 1 seeds
 * it with the migrated B-card on-set abilities.
 */
export const ABILITY_REGISTRY: Record<string, Ability> = {
  draw1: {
    id: 'draw1',
    name: 'Draw 1 card',
    text: 'Draw 1 card.',
    timing: 'on-set',
    activation: 'auto',
    effect: { kind: 'draw', count: 1 },
  },
  draw2: {
    id: 'draw2',
    name: 'Draw 2 cards',
    text: 'Draw 2 cards.',
    timing: 'on-set',
    activation: 'auto',
    effect: { kind: 'draw', count: 2 },
  },
  graveyardIntoDeck: {
    id: 'graveyardIntoDeck',
    name: 'Shuffle graveyard into deck',
    text: 'Shuffle your graveyard into your deck.',
    timing: 'on-set',
    activation: 'auto',
    effect: { kind: 'shuffleZoneIntoDeck', zone: 'graveyard' },
  },
  replenIntoDeck: {
    id: 'replenIntoDeck',
    name: 'Shuffle replen into deck',
    text: 'Shuffle your replen pile into your deck.',
    timing: 'on-set',
    activation: 'auto',
    effect: { kind: 'shuffleZoneIntoDeck', zone: 'replen' },
  },
};

/** Look up an ability by id, or `undefined` if the id is unknown/absent. */
export function abilityById(id: string | undefined): Ability | undefined {
  return id ? ABILITY_REGISTRY[id] : undefined;
}

/** Short label for a card's ability id (empty string when absent/unknown). */
export function abilityLabel(id: string | undefined): string {
  return abilityById(id)?.name ?? '';
}

/**
 * Pure effect dispatcher: run one `EffectSpec` by delegating to the supplied
 * context callbacks. Exhaustive over `EffectSpec.kind` so adding a new effect
 * kind forces a matching executor here.
 */
export function runEffect(effect: EffectSpec, ctx: EffectContext): void {
  switch (effect.kind) {
    case 'draw':
      ctx.draw(effect.count);
      break;
    case 'shuffleZoneIntoDeck':
      ctx.shuffleZoneIntoDeck(effect.zone);
      break;
  }
}
