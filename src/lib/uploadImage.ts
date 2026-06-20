import { supabase } from '@/db/supabase';

// Helper to compress image
const compressImage = async (file: File, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Calculate dimensions keeping aspect ratio (max 1080p)
        let width = img.width;
        let height = img.height;
        const maxDim = 1080;
        
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Failed to get canvas context'));
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to WebP
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Failed to compress image'));
          
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.webp', {
            type: 'image/webp',
          });
          
          resolve(compressedFile);
        }, 'image/webp', quality);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export const uploadFile = async (file: File): Promise<{ url: string | null; error: Error | null; wasCompressed: boolean }> => {
  try {
    let fileToUpload = file;
    let wasCompressed = false;

    // Check if compression is needed (size > 1MB or not WebP)
    const MAX_SIZE = 1024 * 1024; // 1MB
    if (file.type.startsWith('image/')) {
      if (file.size > MAX_SIZE || !file.type.includes('webp')) {
        fileToUpload = await compressImage(file);
        wasCompressed = true;
        
        // If still too large, compress further aggressively
        if (fileToUpload.size > MAX_SIZE) {
          fileToUpload = await compressImage(file, 0.5);
        }
      }
    }

    // Sanitize filename (only English letters, numbers, and dot)
    const ext = fileToUpload.name.split('.').pop() || '';
    const safeName = Math.random().toString(36).substring(2, 15) + Date.now() + '.' + ext;
    const filePath = `uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${safeName}`;

    const { data, error } = await supabase.storage
      .from('project-files')
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('project-files')
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl, error: null, wasCompressed };
  } catch (error: any) {
    console.error('Upload error:', error);
    return { url: null, error, wasCompressed: false };
  }
};
