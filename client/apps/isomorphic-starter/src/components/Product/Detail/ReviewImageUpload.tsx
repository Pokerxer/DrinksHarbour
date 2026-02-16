"use client";

import React, { useState, useCallback, useRef } from "react";
import Image from "next/image";
import * as Icon from "react-icons/pi";

interface ReviewImage {
  url: string;
  publicId?: string;
  alt?: string;
  file?: File;
  preview?: string;
  isUploading?: boolean;
}

interface ReviewImageUploadProps {
  images: ReviewImage[];
  onImagesChange: (images: ReviewImage[]) => void;
  maxImages?: number;
  maxFileSize?: number; // in MB
}

const ReviewImageUpload: React.FC<ReviewImageUploadProps> = ({
  images,
  onImagesChange,
  maxImages = 5,
  maxFileSize = 5, // 5MB default
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'Please upload an image file' };
    }

    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return { valid: false, error: `File size must be less than ${maxFileSize}MB` };
    }

    return { valid: true };
  };

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const newImages: ReviewImage[] = [];

    for (const file of filesToProcess) {
      const validation = validateFile(file);
      if (!validation.valid) {
        alert(`${file.name}: ${validation.error}`);
        continue;
      }

      // Create preview
      const preview = URL.createObjectURL(file);
      
      newImages.push({
        url: preview,
        preview,
        file,
        alt: file.name,
        isUploading: false,
      });
    }

    onImagesChange([...images, ...newImages]);
  }, [images, maxImages, maxFileSize, onImagesChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    const image = images[index];
    // Revoke object URL to prevent memory leaks
    if (image.preview) {
      URL.revokeObjectURL(image.preview);
    }
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const uploadImages = async (): Promise<ReviewImage[]> => {
    const uploadedImages: ReviewImage[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      // If already uploaded (has publicId), skip
      if (image.publicId) {
        uploadedImages.push(image);
        continue;
      }

      if (!image.file) continue;

      // Set uploading state
      const uploadingImages = [...images];
      uploadingImages[i] = { ...image, isUploading: true };
      onImagesChange(uploadingImages);

      try {
        // Create form data
        const formData = new FormData();
        formData.append('file', image.file);
        formData.append('folder', 'reviews');

        // Simulate upload progress (replace with actual upload)
        setUploadProgress(prev => ({ ...prev, [i]: 0 }));
        
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => ({
            ...prev,
            [i]: Math.min((prev[i] || 0) + 10, 90)
          }));
        }, 200);

        // TODO: Replace with actual API endpoint
        // const response = await fetch('/api/upload', {
        //   method: 'POST',
        //   body: formData,
        // });
        // const data = await response.json();

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        clearInterval(progressInterval);
        setUploadProgress(prev => ({ ...prev, [i]: 100 }));

        // Mock response - replace with actual API response
        uploadedImages.push({
          url: image.preview || image.url,
          publicId: `review_${Date.now()}_${i}`,
          alt: image.alt,
          isUploading: false,
        });

      } catch (error) {
        console.error('Upload failed:', error);
        uploadedImages.push({
          ...image,
          isUploading: false,
        });
      }
    }

    return uploadedImages;
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-900">
        Add Photos
        <span className="text-gray-400 font-normal ml-1">
          (optional, max {maxImages} images)
        </span>
      </label>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((image, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-xl overflow-hidden group"
            >
              <Image
                src={image.preview || image.url}
                alt={image.alt || `Upload ${index + 1}`}
                fill
                className="object-cover"
              />
              
              {/* Upload Progress Overlay */}
              {image.isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-10 h-10">
                    <svg className="transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-300"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="text-white"
                        strokeDasharray={`${uploadProgress[index] || 0}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* Remove Button */}
              {!image.isUploading && (
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Remove image"
                >
                  <Icon.PiX size={14} />
                </button>
              )}

              {/* Image Number */}
              <div className="absolute bottom-1 left-1 w-5 h-5 bg-black/50 text-white text-xs rounded-full flex items-center justify-center">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {canAddMore && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-6 cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-gray-900 bg-gray-50' 
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center text-center">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center mb-3
              transition-colors
              ${isDragging ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}
            `}>
              <Icon.PiCamera size={24} />
            </div>
            
            <p className="text-sm font-medium text-gray-900 mb-1">
              {isDragging ? 'Drop images here' : 'Click or drag images here'}
            </p>
            
            <p className="text-xs text-gray-500">
              PNG, JPG, GIF up to {maxFileSize}MB
            </p>
            
            <p className="text-xs text-gray-400 mt-2">
              {images.length} of {maxImages} images
            </p>
          </div>
        </div>
      )}

      {/* Guidelines */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>Tips for great photos:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-1">
          <li>Use natural lighting when possible</li>
          <li>Show the product from multiple angles</li>
          <li>Include photos of packaging if relevant</li>
        </ul>
      </div>
    </div>
  );
};

export default ReviewImageUpload;
