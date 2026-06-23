// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useRef } from 'react';
import { PiX, PiUpload, PiImage, PiSpinner, PiStar, PiStarFill } from 'react-icons/pi';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { uploadService } from '@/services/upload.service';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';

interface ImageItem {
  url: string;
  alt?: string;
  isPrimary?: boolean;
  order?: number;
  // local state only — not sent to server
  publicId?: string;
  thumbnail?: string;
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 22 } },
  exit: { opacity: 0, scale: 0.85, transition: { duration: 0.18 } },
};

export default function SubProductImageOverrides() {
  const { data: session } = useSession();
  const { setValue, watch } = useFormContext();

  // Form field
  const images: ImageItem[] = watch('subProductData.imagesOverride') || [];

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Keep publicIds in ref so we can delete from Cloudinary without polluting the form schema
  const publicIdMap = useRef<Record<string, string>>({}); // url -> publicId

  const updateImages = (next: ImageItem[]) => {
    // Strip local-only fields before writing to form
    const clean = next.map(({ publicId, thumbnail, ...rest }, i) => ({
      ...rest,
      order: rest.order ?? i,
    }));
    setValue('subProductData.imagesOverride', clean);
  };

  const uploadFiles = async (files: File[]) => {
    if (!session?.user?.token) {
      toast.error('Please sign in to upload images');
      return;
    }
    if (images.length + files.length > 10) {
      toast.error('Maximum 10 images allowed');
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadService.uploadProductGallery(files, session.user.token);
      const uploaded: ImageItem[] = res.data.map((img: any, i: number) => {
        publicIdMap.current[img.url] = img.publicId;
        return {
          url: img.url,
          alt: '',
          isPrimary: images.length === 0 && i === 0,
          order: images.length + i,
        };
      });
      updateImages([...images, ...uploaded]);
      toast.success(`${files.length} image${files.length > 1 ? 's' : ''} uploaded`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) uploadFiles(files);
    e.target.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) uploadFiles(files);
  }, [images, session]);

  const removeImage = async (index: number) => {
    const img = images[index];
    if (!img) return;
    const publicId = publicIdMap.current[img.url];
    if (publicId && session?.user?.token) {
      try { await uploadService.deleteImage(publicId, session.user.token); } catch {}
      delete publicIdMap.current[img.url];
    }
    const next = images.filter((_, i) => i !== index);
    if (img.isPrimary && next.length > 0) next[0].isPrimary = true;
    updateImages(next);
  };

  const setPrimary = (index: number) => {
    updateImages(images.map((img, i) => ({ ...img, isPrimary: i === index })));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiImage className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">Image Overrides</span>
          {images.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {images.length}/10
            </span>
          )}
        </div>
        {isUploading && (
          <span className="flex items-center gap-1 text-xs text-blue-600">
            <PiSpinner className="h-3 w-3 animate-spin" />
            Uploading…
          </span>
        )}
      </div>

      {/* Drop zone */}
      <motion.label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragging ? '#3B82F6' : '#D1D5DB',
          backgroundColor: isDragging ? '#EFF6FF' : '#F9FAFB',
        }}
        transition={{ duration: 0.15 }}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        )}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          disabled={isUploading}
          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          {isUploading
            ? <PiSpinner className="h-5 w-5 animate-spin text-blue-600" />
            : <PiUpload className="h-5 w-5 text-blue-600" />
          }
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">
            {isDragging ? 'Drop images here' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-xs text-gray-500">JPG, PNG, WebP — up to 10 images, 10 MB each</p>
        </div>
      </motion.label>

      {/* Preview grid */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
          >
            {images.map((img, index) => (
              <motion.div
                key={img.url + index}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
              >
                <Image
                  src={img.url}
                  alt={img.alt || `Image ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 33vw, 160px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Primary badge */}
                {img.isPrimary && (
                  <div className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                    <PiStarFill className="h-2.5 w-2.5" />
                    Primary
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {!img.isPrimary && (
                    <button
                      type="button"
                      onClick={() => setPrimary(index)}
                      className="flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white shadow hover:bg-amber-600"
                    >
                      <PiStar className="h-3 w-3" />
                      Set Primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="flex items-center gap-1 rounded-lg bg-red-500 px-2 py-1 text-[11px] font-semibold text-white shadow hover:bg-red-600"
                  >
                    <PiX className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {images.length > 0 && (
        <p className="text-xs text-gray-400">
          Star icon = primary image shown first on listing. Hover an image to change it.
        </p>
      )}
    </div>
  );
}
