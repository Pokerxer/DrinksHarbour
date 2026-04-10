'use client';

import { useState, useEffect } from 'react';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { Input, Button, Text, Spinner, Badge } from 'rizzui';
import { PiMagnifyingGlass, PiX, PiCheckCircle, PiImage, PiCheck, PiWarning } from 'react-icons/pi';
import { pinterestService, PinterestImage } from '@/services/pinterest.service';
import { uploadService, UploadedImage } from '@/services/upload.service';
import toast from 'react-hot-toast';

interface PinterestImagePickerProps {
  onImagesSelected: (images: UploadedImage[]) => void;
  initialSearch?: string;
}

function PinterestPickerContent({ onImagesSelected, initialSearch = '' }: PinterestImagePickerProps) {
  const { closeModal } = useModal();
  const [query, setQuery] = useState(initialSearch);
  const [images, setImages] = useState<PinterestImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ authenticated: boolean; configured: boolean; message: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const statusData = await pinterestService.checkStatus();
      setStatus(statusData);
    } catch (error: any) {
      setStatus({
        authenticated: false,
        configured: false,
        message: error.message || 'Failed to check Pinterest status',
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnect = async () => {
    try {
      const { url } = await pinterestService.getOAuthUrl();
      window.location.href = url;
    } catch (error: any) {
      toast.error(error.message || 'Failed to get Pinterest OAuth URL');
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (!status?.authenticated) {
      toast.error('Please connect to Pinterest first');
      return;
    }

    setLoading(true);
    setSearched(true);
    setSelectedIds(new Set());
    try {
      const result = await pinterestService.search(query.trim(), 30);
      setImages(result.results.filter((img) => img.imageUrl));
    } catch (error: any) {
      console.error('Pinterest search error:', error);
      toast.error(error.message || 'Failed to search Pinterest');
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

      if (uploadedImages.length > 0) {
        onImagesSelected(uploadedImages);
        closeModal();
      } else {
        toast.error('Failed to import any images');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import images');
    } finally {
      setImporting(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!status?.authenticated) {
    return (
      <div className="p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PiImage className="w-6 h-6 text-red-600" />
            <Text className="font-semibold text-lg">Connect to Pinterest</Text>
          </div>
          <Button variant="text" onClick={closeModal} className="p-2">
            <PiX className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <PiWarning className="w-16 h-16 text-amber-500 mb-4" />
          <Text className="text-lg font-medium mb-2">Pinterest Not Connected</Text>
          <Text className="text-gray-500 text-center mb-6 max-w-md">
            {status?.configured 
              ? 'Click the button below to authorize access to your Pinterest account and search for images.'
              : status?.message || 'Pinterest is not configured. Please contact the administrator.'}
          </Text>
          
          {status?.configured && (
            <Button
              onClick={handleConnect}
              className="flex items-center gap-2"
            >
              <PiImage className="w-4 h-4" />
              Connect Pinterest Account
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PiImage className="w-6 h-6 text-red-600" />
          <Text className="font-semibold text-lg">Search Pinterest Images</Text>
          <Badge color="success" variant="flat" size="sm">
            Connected
          </Badge>
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
            {importing ? <Spinner className="w-4 h-4" /> : <PiCheck className="w-4 h-4" />}
            Import Selected
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PinterestImagePicker(props: PinterestImagePickerProps) {
  return <PinterestPickerContent {...props} />;
}

export function openPinterestPicker(onImagesSelected: (images: UploadedImage[]) => void, initialSearch?: string) {
  const { openModal } = useModal();
  openModal({
    view: <PinterestImagePicker onImagesSelected={onImagesSelected} initialSearch={initialSearch} />,
    size: 'xl',
  });
}