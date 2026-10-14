import Tilt from 'react-parallax-tilt';
import type { CardDef } from '@/game/types';
import { ELEM_COLORS } from '@/game/data/constants';
import './card.css';

interface Props {
  def: CardDef;
  price?: number; // na loja = custo + 1
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const KIND_LABEL: Record<CardDef['kind'], string> = {
  creature: 'CRIATURA',
  spell: 'SPELL',
  building: 'CONSTRUÇÃO',
  terrain: 'TERRENO',
  item: 'ITEM',
};

const ELEM_ICON: Record<string, string> = { fire: '🔥', water: '💧', grass: '🌿' };
const TIER_LEVEL: Record<NonNullable<CardDef['tier']>, number> = { weak: 1, medium: 2, strong: 3 };

export function Card({ def, price, selected, disabled, onClick }: Props) {
  const color = ELEM_COLORS[def.elem];
  return (
    <Tilt
      tiltMaxAngleX={12}
      tiltMaxAngleY={12}
      glareEnable
      glareMaxOpacity={0.25}
      glarePosition="all"
      scale={selected ? 1.08 : 1.04}
      transitionSpeed={900}
      className={`card ${selected ? 'card--selected' : ''} ${disabled ? 'card--disabled' : ''}`}
    >
      <div
        className="card__inner"
        style={{ ['--elem' as string]: color }}
        onClick={disabled ? undefined : onClick}
      >
        <header className="card__header">
          <span className="card__name">{def.name}</span>
          {price !== undefined ? (
            <span className="card__cost card__cost--price">{price}</span>
          ) : def.cost > 0 ? (
            <span className="card__cost">{def.cost}</span>
          ) : (
            <span className="card__cost card__cost--free">0</span>
          )}
        </header>

        <div className="card__art">
          <span className="card__icon">{ELEM_ICON[def.elem]}</span>
        </div>

        <div className="card__type">{KIND_LABEL[def.kind]}</div>

        {def.kind === 'creature' && def.tier && (
          <div className="card__level">NÍVEL {TIER_LEVEL[def.tier]}</div>
        )}

        {(def.kind === 'creature' || def.kind === 'spell') && (
          <div className="card__stats">
            {def.kind === 'creature' && def.shotDamage !== undefined && (
              <span className="card__atk">⚔ {def.shotDamage}</span>
            )}
            {def.cooldown !== undefined && (
              <span className="card__cd">⏱ {def.cooldown}s</span>
            )}
          </div>
        )}

        {def.text && <div className="card__text">{def.text}</div>}
      </div>
    </Tilt>
  );
}
