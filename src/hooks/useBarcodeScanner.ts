import { useEffect, useRef } from 'react';

interface UseHardwareBarcodeOptions {
  enabled: boolean;
  onScan: (barcode: string) => void;
}

/**
 * Listens for rapid HID keyboard-wedge barcode scanner input bursts ending with Enter.
 * Ignores normal typing inside inputs/textareas unless a scanner-speed burst occurs outside inputs.
 */
export function useHardwareBarcodeScanner({ enabled, onScan }: UseHardwareBarcodeOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isEditable) return;

      const now = performance.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Barcode scanners type characters rapidly (< 65ms apart)
      if (delta > 80) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim();
        bufferRef.current = '';
        if (scanned.length >= 3) {
          e.preventDefault();
          onScan(scanned);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onScan]);
}
