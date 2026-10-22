import { useEffect, useState, type CSSProperties } from 'react';
import { useGameStore } from '../state/useGameStore';
import { parseAbility } from '../abilities/parseAbility';
import { abilityNeedsTarget, abilityTargetOptions, abilityZones, costPickZone } from '../abilities/activated';
import type { AbilityIR } from '../abilities/abilityIR';
import { RARITY_COLOR, TYPE_ACCENT, TYPE_LABEL } from '../cards/cardTheme';
import type { Card, CardId } from '../state/types';

/**
 * One- or two-step resolver for activated abilities that need player selection
 * (e.g. Quick Reload, First Aid Kit, Jackal Reinforcement). Opens when
 * `abilityTargeting` is set.
 *
 *  - `cost` step: pick the Hand / Replen card the ability's cost moves.
 *  - `target` step: pick the Hero (or Graveyard card) the effect applies to.
 *
 * Each step is select-then-confirm: click a card to inspect it (name, stats and
 * full ability text) so the player can read effects that trigger on the move,
 * then Confirm. The cost is only spent when the target is confirmed, so Cancel /
 * backdrop / Escape at either step aborts cleanly. Marked `data-ui-overlay` so
 * PointerControls ignores clicks on it.
 */
export function AbilityTargetModal() {
  const at = useGameStore((s) => s.abilityTargeting);
  const cardsById = useGameStore((s) => s.cardsById);
  const board = useGameStore((s) => s.board);
  const hand = useGameStore((s) => s.hand);
  const replen = useGameStore((s) => s.replen);
  const deck = useGameStore((s) => s.deck);
  const graveyard = useGameStore((s) => s.graveyard);
  const chooseAbilityCost = useGameStore((s) => s.chooseAbilityCost);
  const chooseAbilityTarget = useGameStore((s) => s.chooseAbilityTarget);
  const cancel = useGameStore((s) => s.cancelAbilityTargeting);

  const [selected, setSelected] = useState<CardId | null>(null);

  // Reset the pick whenever the step (or the whole flow) changes.
  const step = at?.step ?? null;
  useEffect(() => {
    setSelected(null);
  }, [step, at?.sourceCardId]);

  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, cancel]);

  if (!at) return null;
  const source = cardsById[at.sourceCardId];
  if (!source || !source.abilities) return null;
  const ir = parseAbility(source.abilities[at.abilityIndex]);

  const zones = abilityZones({ board, cardsById, hand, replen, deck, graveyard });
  const isCost = at.step === 'cost';
  const costZone = costPickZone(ir);
  const totalSteps = (costZone ? 1 : 0) + (abilityNeedsTarget(ir) ? 1 : 0);
  const stepNo = isCost || !costZone ? 1 : 2;
  const title = at.abilityName;
  const copy = isCost ? costCopy(ir) : targetCopy(ir);
  const subtitle = `Click a card to inspect it, then Confirm to ${copy.verb}.`;

  const tiles: Card[] = isCost
    ? (costZone === 'replen' ? replen : hand).map((id) => cardsById[id]).filter((c): c is Card => Boolean(c))
    : abilityTargetOptions(ir, zones, at.sourceCardId);

  const selectedCard = selected ? cardsById[selected] ?? null : null;
  const confirm = () => {
    if (!selected) return;
    if (isCost) chooseAbilityCost(selected);
    else chooseAbilityTarget(selected);
  };

  return (
    <div data-ui-overlay style={BACKDROP_STYLE} onClick={() => cancel()}>
      <div style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>
            <span style={{ color: '#ffb020' }}>{title}</span>
            <span style={{ color: '#8b95a3', fontWeight: 500 }}> · {isCost ? 'Cost' : 'Target'}</span>
          </span>
          <span style={STEP_STYLE}>{`Step ${stepNo} / ${totalSteps}`}</span>
        </div>

        <div style={SUBTITLE_STYLE}>{subtitle}</div>

        {tiles.length === 0 ? (
          <div style={EMPTY_STYLE}>
            {isCost ? 'No cards to pay the cost.' : 'No legal targets.'}
          </div>
        ) : (
          <div style={GRID_SCROLL_STYLE}>
            <div style={GRID_STYLE}>
              {tiles.map((c) => (
                <CardTile key={c.id} card={c} on={selected === c.id} onPick={() => setSelected(c.id)} />
              ))}
            </div>
          </div>
        )}

        {selectedCard && <CardDetail card={selectedCard} />}

        <div style={FOOTER_STYLE}>
          <button type="button" onClick={() => cancel()} style={CANCEL_STYLE}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={confirm}
            style={{
              ...CONFIRM_STYLE,
              opacity: selected ? 1 : 0.4,
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >
            {copy.button}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One selectable card tile. */
function CardTile({ card: c, on, onPick }: { card: Card; on: boolean; onPick: () => void }) {
  const accent = TYPE_ACCENT[c.type];
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        ...TILE_STYLE,
        border: `2px solid ${on ? '#ffcf3f' : RARITY_COLOR[c.rarity]}`,
        boxShadow: on ? '0 0 12px rgba(255,207,63,0.55)' : 'none',
      }}
      title={c.name}
    >
      <div style={{ ...TILE_HEADER_STYLE, background: `linear-gradient(180deg, ${accent}cc, ${accent}77)` }}>
        <span style={{ fontWeight: 800 }}>{c.type}</span>
        {c.level != null && <span style={TILE_LEVEL_STYLE}>Lv {c.level}</span>}
      </div>
      <div style={TILE_NAME_STYLE}>{c.name}</div>
      {c.type === 'A' && (
        <div style={TILE_FOOT_STYLE}>
          <span style={{ color: '#e07a5f' }}>{c.dmg}</span>
          <span style={{ color: '#6aa9e0' }}>{c.acc}</span>
        </div>
      )}
      {on && <div style={CHECK_STYLE}>✓</div>}
    </button>
  );
}

/**
 * Pick-one resolver for optional On-Set abilities (Field Disruption: an enemy
 * Equipment; Reclaim Ops: an Ability Card in your GY). Opens when `onSetChoice`
 * is set. Skip / backdrop / Escape declines the ability.
 */
export function OnSetChoiceModal() {
  const ch = useGameStore((s) => s.onSetChoice);
  const cardsById = useGameStore((s) => s.cardsById);
  const opponentCards = useGameStore((s) => s.opponentCards);
  const resolve = useGameStore((s) => s.resolveOnSetChoice);
  const [selected, setSelected] = useState<CardId | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [ch?.sourceCardId, ch?.abilityIndex]);

  useEffect(() => {
    if (!ch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolve(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ch, resolve]);

  if (!ch) return null;
  const source = cardsById[ch.sourceCardId];
  const ir = parseAbility(source?.abilities?.[ch.abilityIndex] ?? '');
  const enemy = ir.effect.kind === 'opponentEquipmentToReplen';
  const lookup = (id: CardId) => cardsById[id] ?? opponentCards[id];
  const tiles = ch.options.map(lookup).filter((c): c is Card => Boolean(c));
  const selectedCard = selected ? lookup(selected) ?? null : null;
  const verb = enemy ? "send it from your opponent's field to Replen" : 'add it to your Hand';
  const button = enemy ? 'Send to Replen' : 'Add to Hand';

  return (
    <div data-ui-overlay style={BACKDROP_STYLE} onClick={() => resolve(null)}>
      <div style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>
            <span style={{ color: '#ffb020' }}>{ch.abilityName}</span>
            <span style={{ color: '#8b95a3', fontWeight: 500 }}> · On Set</span>
          </span>
        </div>
        <div style={SUBTITLE_STYLE}>{`Click a card to inspect it, then Confirm to ${verb}.`}</div>
        <div style={GRID_SCROLL_STYLE}>
          <div style={GRID_STYLE}>
            {tiles.map((c) => (
              <CardTile key={c.id} card={c} on={selected === c.id} onPick={() => setSelected(c.id)} />
            ))}
          </div>
        </div>
        {selectedCard && <CardDetail card={selectedCard} />}
        <div style={FOOTER_STYLE}>
          <button type="button" onClick={() => resolve(null)} style={CANCEL_STYLE}>
            Skip
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && resolve(selected)}
            style={{ ...CONFIRM_STYLE, opacity: selected ? 1 : 0.4, cursor: selected ? 'pointer' : 'not-allowed' }}
          >
            {button}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Mandatory Hand-cost pick for an Ability (B) card spell (e.g. Convoy Incoming:
 * "Send 1 card from your Hand to the GY"). Opens when `spellCost` is set. The
 * card is already on the field, so there is no Skip — the rest of the spell
 * resolves once a card is confirmed.
 */
export function SpellCostModal() {
  const sc = useGameStore((s) => s.spellCost);
  const cardsById = useGameStore((s) => s.cardsById);
  const resolve = useGameStore((s) => s.resolveSpellCost);
  const [selected, setSelected] = useState<CardId | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [sc?.sourceCardId]);

  if (!sc) return null;
  const source = cardsById[sc.sourceCardId];
  const tiles = sc.options.map((id) => cardsById[id]).filter((c): c is Card => Boolean(c));
  const selectedCard = selected ? cardsById[selected] ?? null : null;
  const dest = sc.to === 'graveyard' ? 'the GY' : 'Replen';

  return (
    <div data-ui-overlay style={BACKDROP_STYLE}>
      <div style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>
            <span style={{ color: '#ffb020' }}>{source?.name ?? 'Ability'}</span>
            <span style={{ color: '#8b95a3', fontWeight: 500 }}> · Cost</span>
          </span>
        </div>
        <div style={SUBTITLE_STYLE}>{`Select 1 card from your Hand to send to ${dest}, then Confirm.`}</div>
        <div style={GRID_SCROLL_STYLE}>
          <div style={GRID_STYLE}>
            {tiles.map((c) => (
              <CardTile key={c.id} card={c} on={selected === c.id} onPick={() => setSelected(c.id)} />
            ))}
          </div>
        </div>
        {selectedCard && <CardDetail card={selectedCard} />}
        <div style={FOOTER_STYLE}>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && resolve(selected)}
            style={{ ...CONFIRM_STYLE, opacity: selected ? 1 : 0.4, cursor: selected ? 'pointer' : 'not-allowed' }}
          >
            {sc.to === 'graveyard' ? 'Send to GY' : 'Send to Replen'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Prompt + button copy for the cost step. */
function costCopy(ir: AbilityIR): { verb: string; button: string } {
  switch (ir.cost?.kind) {
    case 'discardHand':
      return { verb: 'discard it from your Hand', button: 'Discard' };
    case 'sendReplenToGraveyard':
      return { verb: 'send it from your Replen to the GY', button: 'Send to GY' };
    default:
      return { verb: 'send it from your Hand to Replen', button: 'Send to Replen' };
  }
}

/** Prompt + button copy for the target step. */
function targetCopy(ir: AbilityIR): { verb: string; button: string } {
  switch (ir.effect.kind) {
    case 'healTarget':
      return { verb: `restore ${ir.effect.amount} HP to it`, button: 'Recover HP' };
    case 'recoverFromGraveyard':
      return { verb: 'send it from your GY to Replen', button: 'Send to Replen' };
    default:
      return { verb: 'apply the buff', button: 'Apply Buff' };
  }
}

/** Inline detail of the currently-selected card so the player can read its stats
 *  and full ability text before committing. */
function CardDetail({ card }: { card: Card }) {
  const accent = TYPE_ACCENT[card.type];
  return (
    <div style={DETAIL_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 800, color: accent }}>{card.name}</span>
        <span style={{ fontSize: 11, color: '#8b95a3' }}>
          {TYPE_LABEL[card.type]}
          {card.subType ? ` · ${card.subType}` : ''}
          {card.level != null ? ` · Lv ${card.level}` : ''}
        </span>
      </div>
      {card.type === 'A' && card.abilities && card.abilities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {card.abilities.map((text, i) => {
            const colon = text.indexOf(':');
            const name = colon > 0 ? text.slice(0, colon) : `Ability ${i + 1}`;
            const body = colon > 0 ? text.slice(colon + 1).trim() : text;
            return (
              <div key={i} style={DETAIL_ABILITY_STYLE}>
                <span style={{ fontWeight: 700, color: '#c9d2dc' }}>{name}: </span>
                <span style={{ color: '#9aa0a8' }}>{body}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#9aa0a8' }}>
          {card.effect ? card.effect : 'No ability text.'}
        </div>
      )}
    </div>
  );
}

const BACKDROP_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(4,6,10,0.55)',
  zIndex: 25,
};

const PANEL_STYLE: CSSProperties = {
  width: 560,
  maxWidth: '92vw',
  background: 'linear-gradient(180deg, #1a2029 0%, #12161d 100%)',
  border: '1px solid #4a3d18',
  borderRadius: 14,
  boxShadow: '0 18px 60px rgba(0,0,0,0.6)',
  color: '#e8eaed',
  fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
  userSelect: 'none',
  overflow: 'hidden',
};

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid #2a333f',
  fontSize: 15,
};

const STEP_STYLE: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0.5,
  color: '#c9d2dc',
};

const SUBTITLE_STYLE: CSSProperties = {
  padding: '8px 16px 0',
  fontSize: 12.5,
  color: '#8b95a3',
};

const EMPTY_STYLE: CSSProperties = {
  padding: '40px 16px',
  textAlign: 'center',
  color: '#7c8594',
  fontSize: 14,
};

const GRID_SCROLL_STYLE: CSSProperties = {
  maxHeight: 300,
  overflowY: 'auto',
  padding: 14,
};

const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 12,
};

const TILE_STYLE: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 8,
  overflow: 'hidden',
  background: '#0e1218',
  aspectRatio: '5 / 7',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
};

const TILE_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '3px 6px',
  fontSize: 13,
  color: '#f5e6c8',
};

const TILE_LEVEL_STYLE: CSSProperties = {
  padding: '1px 6px',
  fontSize: 11,
  fontWeight: 800,
  borderRadius: 8,
  background: 'rgba(0,0,0,0.4)',
  color: '#ffdf87',
};

const TILE_NAME_STYLE: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '4px 4px',
  fontSize: 10.5,
  lineHeight: 1.15,
  color: '#dfe4ea',
};

const TILE_FOOT_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '3px 6px',
  fontSize: 11,
  fontWeight: 700,
  borderTop: '1px solid #1e2530',
};

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  padding: '12px 16px',
  borderTop: '1px solid #2a333f',
};

const CHECK_STYLE: CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 20,
  height: 20,
  lineHeight: '20px',
  textAlign: 'center',
  borderRadius: '50%',
  background: '#ffcf3f',
  color: '#1a1206',
  fontWeight: 900,
  fontSize: 13,
};

const DETAIL_STYLE: CSSProperties = {
  margin: '0 16px 4px',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid #2a333f',
  borderRadius: 8,
  fontSize: 12.5,
};

const DETAIL_ABILITY_STYLE: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.4,
};

const CANCEL_STYLE: CSSProperties = {
  padding: '8px 16px',
  color: '#c9d2dc',
  background: 'transparent',
  border: '1px solid #3a4552',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
};

const CONFIRM_STYLE: CSSProperties = {
  padding: '8px 18px',
  color: '#1a1206',
  background: 'linear-gradient(180deg, #ffe08a, #e6b53f)',
  border: '1px solid #b98f2a',
  borderRadius: 8,
  fontWeight: 800,
};
