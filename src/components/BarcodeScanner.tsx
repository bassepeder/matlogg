import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

type DetectorCtor = {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
};

let detectorPromise: Promise<Detector> | null = null;

function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (Native) {
      try {
        const supported = await Native.getSupportedFormats();
        const formats = FORMATS.filter((f) => supported.includes(f));
        if (formats.length) return new Native({ formats });
      } catch {
      }
    }
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]);
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
    });
    return new BarcodeDetector({ formats: FORMATS as never });
  })();
  return detectorPromise;
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return t('camera.denied');
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return t('camera.none');
  if (name === 'NotReadableError') return t('camera.busy');
  return t('camera.failed', { message: String((e as Error)?.message ?? e) });
}

export function BarcodeScanner({ onDetect, active }: { onDetect: (code: string) => void; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t('camera.https'));
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = await getDetector();
        setStarting(false);

        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              const hit = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
              if (hit && !stopped) {
                stopped = true;
                navigator.vibrate?.(40);
                onDetectRef.current(hit.rawValue);
                return;
              }
            } catch {
            }
          }
          timer = setTimeout(tick, 120);
        };
        tick();
      } catch (e) {
        if (!stopped) {
          setError(cameraError(e));
          setStarting(false);
        }
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  if (error) return <p className="notice error">{error}</p>;
  return (
    <div className="scanner">
      <video ref={videoRef} muted playsInline />
      <div className="scanner-frame" aria-hidden="true" />
      {starting && <div className="scanner-status">{t('camera.starting')}</div>}
    </div>
  );
}
