import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { uploadFile } from '@/lib/uploadImage';

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxFiles?: number;
  label?: string;
}

export function ImageUpload({ images = [], onChange, maxFiles = 5, label = 'رفع صور' }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    if (images.length + e.target.files.length > maxFiles) {
      toast.error(`عذراً، الحد الأقصى هو ${maxFiles} ملفات`);
      return;
    }

    setIsUploading(true);
    
    const newUrls: string[] = [...images];
    
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      try {
        const { url, error, wasCompressed } = await uploadFile(file);
        if (error) throw error;
        if (url) {
          newUrls.push(url);
          if (wasCompressed) {
            toast.info(`تم ضغط الصورة ${file.name} لتسريع التحميل`);
          }
        }
      } catch (err: any) {
        toast.error(`فشل رفع ${file.name}: ${err.message}`);
      }
    }
    
    onChange(newUrls);
    setIsUploading(false);
    
    // Reset input
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="cursor-pointer">
          <Button type="button" variant="outline" disabled={isUploading || images.length >= maxFiles} asChild>
            <span>
              {isUploading ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Upload className="h-4 w-4 ml-2" />}
              {label}
            </span>
          </Button>
          <input 
            type="file" 
            className="hidden" 
            accept="image/*" 
            multiple 
            onChange={handleFileChange} 
            disabled={isUploading || images.length >= maxFiles}
          />
        </label>
        <span className="text-sm text-muted-foreground">
          {images.length} / {maxFiles} مرفق
        </span>
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative group border rounded-md overflow-hidden h-20 w-20 bg-muted/30">
              <img src={url} alt={`Preview ${i}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
