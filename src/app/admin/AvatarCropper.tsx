'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Lightweight square-avatar cropper. Loads the picked file, lets the user zoom + drag to
 * frame it, and exports a 256×256 JPEG data URL (~15–25KB) — small enough to live on
 * User.image and be served via /api/hosts without a storage bucket or new dependency.
 * Shared by the rep's own profile editor and the super-admin team editor.
 */
export default function AvatarCropper({ file, onApply, onCancel }: { file: File; onApply: (dataUrl: string) => void; onCancel: () => void }) {
  const DISPLAY = 240;
  const OUT = 256;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const baseScale = img ? Math.max(DISPLAY / img.width, DISPLAY / img.height) : 1;
  const scale = baseScale * zoom;

  // Keep the image covering the square (no empty gutters).
  const clamp = (o: { x: number; y: number }, s: number) => {
    if (!img) return o;
    const w = img.width * s, h = img.height * s;
    return {
      x: Math.min(0, Math.max(DISPLAY - w, o.x)),
      y: Math.min(0, Math.max(DISPLAY - h, o.y)),
    };
  };

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const bs = Math.max(DISPLAY / im.width, DISPLAY / im.height);
      setImg(im);
      setZoom(1);
      setOffset({ x: (DISPLAY - im.width * bs) / 2, y: (DISPLAY - im.height * bs) / 2 });
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#EBEAE6';
    ctx.fillRect(0, 0, DISPLAY, DISPLAY);
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
  }, [img, offset, scale]);

  // Re-clamp when zoom changes so we never expose a gutter.
  useEffect(() => { setOffset((o) => clamp(o, scale)); }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }, scale));
  };
  const onUp = () => { drag.current = null; };

  const apply = () => {
    if (!img) return;
    const out = document.createElement('canvas');
    out.width = OUT; out.height = OUT;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    const f = OUT / DISPLAY;
    ctx.fillStyle = '#EBEAE6';
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, offset.x * f, offset.y * f, img.width * scale * f, img.height * scale * f);
    onApply(out.toDataURL('image/jpeg', 0.82));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(24,25,21,0.5)' }}>
      <div className="rounded-xl p-5 w-full max-w-xs" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#181915' }}>Crop the photo</h3>
        <div
          className="relative mx-auto rounded-full overflow-hidden touch-none cursor-move"
          style={{ width: DISPLAY, height: DISPLAY, border: '1px solid #E5E4E0' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <canvas ref={canvasRef} width={DISPLAY} height={DISPLAY} />
        </div>
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[11px]" style={{ color: '#9CA3AF' }}>Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="flex-1" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md text-sm" style={{ color: '#6B7280', border: '1px solid #E5E4E0', backgroundColor: 'white' }}>Cancel</button>
          <button type="button" onClick={apply} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ backgroundColor: '#13352F', color: 'white' }}>Apply</button>
        </div>
      </div>
    </div>
  );
}
