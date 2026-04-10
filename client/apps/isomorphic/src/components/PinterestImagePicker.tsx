'use client';

import { useState } from 'react';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { Input, Button, Text, Spinner } from 'rizzui';
import { PiMagnifyingGlass, PiX, PiCheckCircle, PiImage, PiDownloadSimple } from 'react-icons/pi';
import { pinterestService, PinterestImage } from '@/services/pinterest.service';
import { uploadService, UploadedImage } from '@/services/upload.service';

interface PinterestImagePickerProps {
  onImagesSelected: (images: UploadedImage[]) => void;
  initialSearch?: string;
}

export default function PinterestImagePicker({ onImagesSelected, initialSearch = '' }: PinterestImagePickerProps) {
  const { closeModal } = useModal();
  const [query, setQuery] = useState(initialSearch);
  const [images, setImages] = useState<PinterestImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedIds(new Set());
    try {
      const result = await pinterestService.search(query.trim(), 30);
      setImages(result.results.filter((img) => img.imageUrl));
    } catch (error: any) {
      console.error('Pinterest search error:', error);
      alert(error.message || 'Failed to search Pinterest');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);

    try {
      const selectedImages = images.filter((img) => selectedIds.has(img.id));
      const uploadedImages: UploadedImage[] = [];

      for (const img of selectedImages) {
        try {
          const blob = await fetch(img.imageUrl).then((r) => r.blob());
          const file = new File([blob], `${img.id}.jpg`, { type: 'image/jpeg' });
          const response = await uploadService.uploadProductGallery([file], '');
          if (response.data?.[0]) {
            uploadedImages.push({
              url: response.data[0].url,
              publicId: response.data[0].publicId,
              isPrimary: uploadedImages.length === 0,
            });
          }
        } catch (err) {
          console.error('Failed to import image:', img.id, err);
        }
      }

      onImagesSelected(uploadedImages);
      closeModal();
    } catch (error: any) {
      console.error('Import error:', error);
      alert(error.message || 'Failed to import images');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PiImage className="w-6 h-6 text-red-600" />
          <Text className="font-semibold text-lg">Search Pinterest Images</Text>
        </div>
        <Button variant="text" onClick={closeModal} className="p-2">
          <PiX className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Search for images..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? <Spinner className="w-4 h-4" /> : <PiMagnifyingGlass className="w-4 h-4" />}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[400px]">
        {!searched && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <PiMagnifyingGlass className="w-12 h-12 mb-2" />
            <Text>Enter a search term to find images</Text>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-full">
            <Spinner className="w-8 h-8" />
          </div>
        )}

        {searched && !loading && images.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Text>No images found for "{query}"</Text>
          </div>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${
                  selectedIds.has(img.id) ? 'border-red-600 ring-2 ring-red-600 ring-offset-2' : 'border-transparent'
                }`}
                onClick={() => toggleSelection(img.id)}
              >
                <img src={img.imageUrl} alt={img.title || 'Pinterest image'} className="w-full h-full object-cover" />
                {selectedIds.has(img.id) && (
                  <div className="absolute top-1 right-1 bg-red-600 rounded-full p-1">
                    <PiCheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <Text className="text-sm text-gray-600">{selectedIds.size} image(s) selected</Text>
          <Button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-2"
          >
            {importing ? <Spinner className="w-4 h-4" /> : <PiDownloadSimple className="w-4 h-4" />}
            Import Selected
          </Button>
        </div>
      )}
    </div>
  );
}

export function openPinterestPicker(onImagesSelected: (images: UploadedImage[]) => void, initialSearch?: string) {
  const { openModal } = useModal();
  openModal({
    view: <PinterestImagePicker onImagesSelected={onImagesSelected} initialSearch={initialSearch} />,
    size: 'xl',
  });
}