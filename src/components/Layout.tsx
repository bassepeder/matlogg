import type { ReactNode } from 'react';
import { t } from '../lib/i18n';
import { back, replace } from '../lib/router';
import { Icon } from './Icon';

export function TopBar({ title, onBack, right }: { title: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="topbar">
      <button className="icon-btn" aria-label={t('common.back')} onClick={onBack ?? (() => back())}>
        <Icon name="back" />
      </button>
      <div className="topbar-title">{title}</div>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

export type Tab = 'diary' | 'foods' | 'settings';

const TABS: { id: Tab; path: string; icon: 'diary' | 'foods' | 'settings' }[] = [
  { id: 'diary', path: '/', icon: 'diary' },
  { id: 'foods', path: '/foods', icon: 'foods' },
  { id: 'settings', path: '/settings', icon: 'settings' },
];

export function BottomNav({ active }: { active: Tab }) {
  return (
    <nav className="bottom-nav" aria-label={t('nav.main')}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={tab.id === active ? 'active' : ''}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => replace(tab.path)}
        >
          <Icon name={tab.icon} />
          <span>{t(`nav.${tab.id}`)}</span>
        </button>
      ))}
    </nav>
  );
}

export function NutrientGrid({ values }: { values: { label: string; value: string }[] }) {
  return (
    <dl className="nutrient-grid">
      {values.map((v) => (
        <div key={v.label}>
          <dt>{v.label}</dt>
          <dd>{v.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MealPicker<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
