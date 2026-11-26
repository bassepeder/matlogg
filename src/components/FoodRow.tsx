import { getLang, t } from '../lib/i18n';
import { fmtKcal } from '../lib/nutrition';
import { sourceLabel, type Food } from '../lib/types';

// Proxied VetDuAt images are loaded with CORS so the service worker can cache them at their real
// size (an opaque cross-origin response counts as several MB against the storage quota).
export function imageCors(src?: string): 'anonymous' | undefined {
  return src?.includes('/api/images/') ? 'anonymous' : undefined;
}

export function Thumb({ src }: { src?: string }) {
  return (
    <span className="thumb">
      {src && (
        <img
          src={src}
          crossOrigin={imageCors(src)}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
    </span>
  );
}

export function FoodRow({ food, sub, thumb, onClick }: { food: Food; sub?: string; thumb?: boolean; onClick: () => void }) {
  const detail =
    sub ??
    [food.brand, getLang() === 'en' ? food.altName : null, food.source !== 'matvaretabellen' && food.source !== 'vetduat' ? sourceLabel(food.source) : null]
      .filter(Boolean)
      .join(' · ');
  return (
    <li>
      <button className="row" onClick={onClick}>
        {thumb && <Thumb src={food.image} />}
        <span className="row-main">
          <span className="row-title">{food.name}</span>
          {detail && <span className="row-sub">{detail}</span>}
        </span>
        <span className="row-value">
          {fmtKcal(food.per100.kcal)}
          <small> {t('unit.kcalPer100')}</small>
        </span>
      </button>
    </li>
  );
}
