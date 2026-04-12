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

export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  // set each dimensions to double largest dimension to allow for a safe area for the
  // image to rotate in without being clipped by canvas context
  canvas.width = safeArea;
  canvas.height = safeArea;

  // translate canvas context to a central location on image to allow rotating around the center.
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(getRadianAngle(rotation));
  ctx.translate(-safeArea / 2, -safeArea / 2);

  // draw rotated image and store data.
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  // set canvas width to final desired crop size - this will clear existing context
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // paste generated rotate image with correct offsets for x,y crop values.
  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  // As a blob
  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      resolve(file);
    }, 'image/jpeg');
  });
}

export default function AvatarCropperModal({ open, imageSrc, onCancel, onSave }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      onSave(croppedBlob);
    } catch (e) {
      console.error(e);
    }
  };

  if (!open || !imageSrc) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 z-[1050] backdrop-blur-sm" onClick={onCancel}></div>
      <div className="fixed inset-0 z-[1060] flex items-center justify-center p-4 py-8 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h5 className="text-lg font-bold text-slate-800 m-0">Chỉnh sửa ảnh đại diện</h5>
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors border-0 bg-transparent cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="relative w-full h-[400px] bg-slate-50">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex items-center gap-4 mb-4 px-2">
              <i className="fa-solid fa-image text-slate-400 text-sm"></i>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <i className="fa-solid fa-image text-slate-500 text-lg"></i>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={onCancel}
                className="px-6 py-2 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-colors border-0 cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-crop"></i> Cắt ảnh & Lưu
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
