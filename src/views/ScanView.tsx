import { useState, type FormEvent } from 'react';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { TopBar } from '../components/Layout';
import { useSettings } from '../lib/hooks';
import { t } from '../lib/i18n';
import { findByBarcode } from '../lib/barcode';
import { vetduatProxyUrl } from '../lib/lookup';
import { replace } from '../lib/router';
import type { MealId } from '../lib/types';
import { logPath, newFoodPath } from './AddView';

type Status =
  | { kind: 'scanning' }
  | { kind: 'looking'; code: string }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'notfound'; code: string; warnings: string[] };

export function ScanView({ date, meal }: { date: string; meal: MealId }) {
  const settings = useSettings();
  const [status, setStatus] = useState<Status>({ kind: 'scanning' });
  const [manual, setManual] = useState('');

  async function handleCode(raw: string) {
    const code = raw.replace(/\D/g, '');
    if (code.length < 8) return;
    setStatus({ kind: 'looking', code });

    try {
      const result = await findByBarcode(code, vetduatProxyUrl(settings));
      if (result.food) return replace(logPath(date, meal, result.food.id));
      if (result.warnings?.length && !result.partial?.name) {
        return setStatus({ kind: 'notfound', code, warnings: result.warnings });
      }
      replace(
        newFoodPath({
          date,
          meal,
          ean: code,
          name: result.partial?.name,
          brand: result.partial?.brand,
          pkg: result.partial?.packageGrams,
          notice: result.partial?.name ? 'nonutrition' : 'notfound',
        }),
      );
    } catch (e) {
      setStatus({ kind: 'error', code, message: (e as Error).message });
    }
  }

  function submitManual(e: FormEvent) {
    e.preventDefault();
    handleCode(manual);
  }

  const createPath = (code: string) => newFoodPath({ date, meal, ean: code, notice: 'notfound' });

  return (
    <>
      <TopBar title={t('scan.title')} />
      <main className="page">
        <BarcodeScanner active={status.kind === 'scanning'} onDetect={handleCode} />

        {status.kind === 'looking' && <p className="notice">{t('scan.looking', { code: status.code })}</p>}

        {(status.kind === 'error' || status.kind === 'notfound') && (
          <div className="notice error">
            <p>
              {status.kind === 'error'
                ? status.message
                : t('scan.notFoundWarn', { code: status.code, warnings: status.warnings.join(' ') })}
            </p>
            <div className="button-row">
              <button className="btn secondary" onClick={() => handleCode(status.code)}>
                {t('scan.retry')}
              </button>
              <button className="btn secondary" onClick={() => replace(createPath(status.code))}>
                {t('scan.manual')}
              </button>
              <button className="btn secondary" onClick={() => setStatus({ kind: 'scanning' })}>
                {t('scan.another')}
              </button>
            </div>
          </div>
        )}

        <form className="manual-code" onSubmit={submitManual}>
          <label className="field-label" htmlFor="ean">
            {t('scan.typeLabel')}
          </label>
          <div className="amount-row">
            <input
              id="ean"
              className="input"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('scan.placeholder')}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={manual.replace(/\D/g, '').length < 8 || status.kind === 'looking'}>
              {t('scan.lookup')}
            </button>
          </div>
        </form>

        {!vetduatProxyUrl(settings) && (
          <p className="hint">{t('scan.offOnly')}</p>
        )}
      </main>
    </>
  );
}
