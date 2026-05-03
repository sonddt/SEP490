import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Cắt ảnh theo vùng pixelCrop, trả về blob JPEG đã nén.
 */
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(getRadianAngle(rotation));
  ctx.translate(-safeArea / 2, -safeArea / 2);

  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (file) => resolve(file),
      'image/jpeg',
      0.92,
    );
  });
}

/**
 * Modal crop ảnh hình chữ nhật — dùng cho thumbnail venue.
 *
 * Props:
 * - open: boolean
 * - imageSrc: string (object URL hoặc data URL)
 * - onCancel: () => void
 * - onSave: (blob: Blob) => void
 * - title?: string
 * - aspect?: number (mặc định 16/10)
 */
export default function ImageCropperModal({
  open,
  imageSrc,
  onCancel,
  onSave,
  title = 'Chỉnh sửa ảnh đại diện',
  aspect = 16 / 10,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_croppedArea, croppedAreaPx) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      onSave(croppedBlob);
    } catch (e) {
      console.error('Crop error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !imageSrc) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/60 z-[1050] backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="fixed inset-0 z-[1060] flex items-center justify-center p-4 py-8 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h5 className="text-lg font-bold text-slate-800 m-0">{title}</h5>
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors border-0 bg-transparent cursor-pointer"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Cropper area */}
          <div className="relative w-full h-[400px] bg-slate-900">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>

          {/* Controls */}
          <div className="p-4 bg-white border-t border-slate-100">
            {/* Zoom slider */}
            <div className="flex items-center gap-4 mb-4 px-2">
              <i className="fa-solid fa-image text-slate-400 text-sm" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <i className="fa-solid fa-image text-slate-500 text-lg" />
            </div>

            {/* Aspect ratio hint */}
            <p className="text-xs text-slate-400 text-center mb-3">
              Tỷ lệ khung hình: 16:10 — phù hợp hiển thị trên trang sân
            </p>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-6 py-2 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-colors border-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" />
                    Đang xử lý…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-crop" /> Cắt ảnh & Lưu
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
