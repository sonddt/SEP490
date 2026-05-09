/**
 * Nén ảnh tự động bằng Canvas API trước khi upload.
 * Giảm ảnh 3-10MB từ điện thoại xuống ~300-500KB mà vẫn đủ rõ.
 *
 * @param {File} file - File ảnh gốc
 * @param {Object} options
 * @param {number} [options.maxWidth=1600] - Chiều rộng tối đa (px)
 * @param {number} [options.maxHeight=1200] - Chiều cao tối đa (px)
 * @param {number} [options.quality=0.8] - Chất lượng JPEG (0-1)
 * @param {number} [options.skipIfBelow=500*1024] - Bỏ qua nén nếu file nhỏ hơn (bytes)
 * @returns {Promise<File>} File đã nén (hoặc file gốc nếu đã nhỏ)
 */
export function compressImage(file, {
  maxWidth = 1600,
  maxHeight = 1200,
  quality = 0.8,
  skipIfBelow = 500 * 1024,
} = {}) {
  return new Promise((resolve) => {
    // Nếu file đã nhỏ thì không cần nén
    if (file.size <= skipIfBelow) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Tính tỉ lệ thu nhỏ
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // Giữ lại tên gốc nhưng đổi đuôi
          const name = file.name.replace(/\.[^.]+$/, '') + '_compressed.jpg';
          resolve(new File([blob], name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * Nén nhiều file ảnh song song.
 * @param {File[]} files - Mảng file ảnh gốc
 * @param {Object} options - Tùy chọn nén (xem compressImage)
 * @returns {Promise<File[]>} Mảng file đã nén
 */
export function compressImages(files, options = {}) {
  return Promise.all(files.map((f) => compressImage(f, options)));
}
