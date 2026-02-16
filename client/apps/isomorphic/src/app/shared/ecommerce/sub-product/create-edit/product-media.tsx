// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Text, Button, Badge } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import FormGroup from '@/app/shared/form-group';
import { useState, useCallback } from 'react';
import { PiX, PiUpload, PiImage, PiVideo, PiSpinner, PiSparkle } from 'react-icons/pi';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { uploadService } from '@/services/upload.service';
import toast from 'react-hot-toast';

interface ProductMediaProps {
  className?: string;
}

interface UploadedImage {
  url: string;
  publicId: string;
  thumbnail: string;
  isPrimary: boolean;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: { duration: 0.2 },
  },
};

export default function ProductMedia({
  className,
}: ProductMediaProps) {
  const { data: session } = useSession();
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const uploadedImages = watch('uploadedImages') || [];
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingIndexes, setUploadingIndexes] = useState<number[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      handleFiles(files);
    }
  }, []);

  const uploadFilesToCloudinary = async (files: File[]) => {
    if (!session?.user?.token) {
      toast.error('Please sign in to upload images');
      return;
    }

    setIsUploading(true);
    const startIndex = uploadedImages.length;
    
    // Mark files as uploading
    files.forEach((_, idx) => {
      setUploadingIndexes(prev => [...prev, startIndex + idx]);
    });

    try {
      const response = await uploadService.uploadProductGallery(
        files,
        session.user.token
      );

      // Add uploaded images to form
      const newImages: UploadedImage[] = response.data.map((img, index) => ({
        url: img.url,
        publicId: img.publicId,
        thumbnail: img.thumbnail,
        isPrimary: uploadedImages.length === 0 && index === 0, // First uploaded image is primary
      }));

      const currentImages = uploadedImages || [];
      setValue('uploadedImages', [...currentImages, ...newImages]);
      
      toast.success(`${files.length} image(s) uploaded successfully`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setIsUploading(false);
      // Clear uploading state
      files.forEach((_, idx) => {
        setUploadingIndexes(prev => prev.filter(i => i !== startIndex + idx));
      });
    }
  };

  const handleFiles = async (files: File[]) => {
    const currentImages = uploadedImages || [];
    
    // Check if adding these files would exceed the limit
    if (currentImages.length + files.length > 10) {
      toast.error('Maximum 10 images allowed');
      return;
    }

    // Upload files to Cloudinary
    await uploadFilesToCloudinary(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const removeImage = async (index: number) => {
    const imageToRemove = uploadedImages[index];
    
    if (!imageToRemove) return;

    // Delete from Cloudinary if we have a publicId
    if (imageToRemove.publicId && session?.user?.token) {
      try {
        await uploadService.deleteImage(imageToRemove.publicId, session.user.token);
      } catch (error) {
        console.error('Failed to delete image from Cloudinary:', error);
        // Continue with removing from UI even if Cloudinary delete fails
      }
    }

    const newImages = [...uploadedImages];
    newImages.splice(index, 1);
    
    // If we removed the primary image, set the first remaining as primary
    if (imageToRemove.isPrimary && newImages.length > 0) {
      newImages[0].isPrimary = true;
    }
    
    setValue('uploadedImages', newImages);
    toast.success('Image removed');
  };

  const setAsPrimary = (index: number) => {
    const newImages = uploadedImages.map((img: UploadedImage, idx: number) => ({
      ...img,
      isPrimary: idx === index,
    }));
    
    setValue('uploadedImages', newImages);
    toast.success('Primary image updated');
  };

  return (
    <FormGroup
      title="Media & Gallery"
      description="Upload product images and video URLs"
      className={cn(className)}
    >
      <motion.div 
        className="grid gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Product Images Upload */}
        <motion.div variants={itemVariants}>
          <label className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
            <PiImage className="h-4 w-4" />
            Product Images
            {uploadedImages.length > 0 && (
              <Badge size="sm" color="primary" variant="flat">
                {uploadedImages.length}/10
              </Badge>
            )}
            {isUploading && (
              <span className="ml-2 flex items-center gap-1 text-xs text-blue-600">
                <PiSpinner className="h-3 w-3 animate-spin" />
                Uploading...
              </span>
            )}
          </label>
          
          {/* Drop Zone */}
          <motion.div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            animate={{
              scale: isDragging ? 1.02 : 1,
              borderColor: isDragging ? '#3B82F6' : '#E5E7EB',
              backgroundColor: isDragging ? '#EFF6FF' : '#FFFFFF',
            }}
            transition={{ duration: 0.2 }}
            className={cn(
              'relative rounded-2xl border-2 border-dashed p-8 transition-all duration-200',
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              disabled={isUploading}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <div className="flex flex-col items-center justify-center text-center">
              <motion.div
                animate={{ y: isDragging ? -5 : 0 }}
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100"
              >
                {isUploading ? (
                  <PiSpinner className="h-8 w-8 animate-spin text-blue-600" />
                ) : (
                  <PiUpload className="h-8 w-8 text-blue-600" />
                )}
              </motion.div>
              <p className="mb-1 text-sm font-medium text-gray-900">
                {isDragging ? 'Drop images here' : 'Drag & drop images here'}
              </p>
              <p className="text-xs text-gray-500">
                or click to browse (max 10 images)
              </p>
              <p className="mt-2 text-xs text-gray-400">
                JPG, PNG, WebP up to 10MB each
              </p>
            </div>
          </motion.div>

          {/* Image Preview Grid */}
          <AnimatePresence>
            {uploadedImages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              >
                {uploadedImages.map((image: UploadedImage, index: number) => (
                  <motion.div
                    key={image.publicId || index}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                  >
                    {uploadingIndexes.includes(index) ? (
                      <div className="flex h-full items-center justify-center">
                        <PiSpinner className="h-8 w-8 animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <>
                        <Image
                          src={image.thumbnail || image.url}
                          alt={`Product image ${index + 1}`}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        
                        {/* Overlay */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          whileHover={{ opacity: 1 }}
                          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50"
                        >
                          {image.isPrimary ? (
                            <Badge size="sm" color="warning" className="absolute left-2 top-2">
                              Primary
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="flat"
                              onClick={() => setAsPrimary(index)}
                              className="text-xs"
                            >
                              Set as Primary
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            onClick={() => removeImage(index)}
                            className="text-xs"
                          >
                            <PiX className="h-3 w-3" />
                            Remove
                          </Button>
                        </motion.div>
                      </>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Videos */}
        <motion.div 
          variants={itemVariants}
          className="rounded-xl border border-gray-200 bg-gray-50/50 p-6"
        >
          <label className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
            <PiVideo className="h-4 w-4" />
            Video URLs
          </label>
          <div className="space-y-3">
            <motion.div
              whileFocus={{ scale: 1.01 }}
              className="relative"
            >
              <input
                type="url"
                placeholder="YouTube or Vimeo URL"
                className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                {...register('videos.0.url')}
              />
            </motion.div>
            <motion.div
              whileFocus={{ scale: 1.01 }}
              className="relative"
            >
              <input
                type="url"
                placeholder="Additional Video URL (optional)"
                className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                {...register('videos.1.url')}
              />
            </motion.div>
          </div>
          <Text className="mt-3 flex items-center gap-1 text-xs text-gray-500">
            <PiSparkle className="h-3 w-3" />
            Add video URLs to showcase your product
          </Text>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}
