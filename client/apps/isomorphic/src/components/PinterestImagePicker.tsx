'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@core/modal-views/modal';
import { pinterestService } from '@/services/pinterest.service';
import { uploadService, UploadedImage } from '@/services/upload.service';
import toast from 'react-hot-toast';

interface PinterestImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onImagesSelected: (images: UploadedImage[]) => void;
  initialSearch?: string;
}

export default function PinterestImagePicker({ isOpen, onClose, onImagesSelected, initialSearch = '' }: PinterestImagePickerProps) {
  const [query, setQuery] = useState(initialSearch);
  const [images, setImages] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ authenticated: boolean; configured: boolean; message: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && status?.authenticated && initialSearch) {
      setQuery(initialSearch);
      if (!searched) {
        handleSearch(initialSearch);
      }
    }
  }, [isOpen, status?.authenticated]);

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

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    if (!status?.authenticated) {
      toast.error('Please connect to Pinterest first');
      return;
    }

    setLoading(true);
    setSearched(true);
    setSelectedIds(new Set());
    try {
      const result = await pinterestService.search(q.trim(), 30);
      setImages(result.results.filter((img: any) => img.imageUrl));
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
        handleClose();
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

  const handleClose = () => {
    setQuery('');
    setImages([]);
    setSelectedIds(new Set());
    setSearched(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <div className="p-6">
        {checkingStatus ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <span>Loading...</span>
          </div>
        ) : !status?.authenticated ? (
          <div className="max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Connect to Pinterest</h2>
              <button onClick={handleClose} className="p-2">✕</button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 text-center mb-6 max-w-md">
                {status?.configured 
                  ? 'Click the button below to authorize access to your Pinterest account.'
                  : status?.message || 'Pinterest is not configured.'}
              </p>
              {status?.configured && (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-red-600 text-white rounded"
                >
                  Connect Pinterest Account
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Search Pinterest Images</h2>
              <button onClick={handleClose} className="p-2">✕</button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search for images..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 border rounded"
              />
              <button 
                onClick={() => handleSearch()} 
                disabled={loading || !query.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {loading ? '...' : 'Search'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[400px]">
              {!searched && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <p>Enter a search term to find images</p>
                </div>
              )}
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <span>Loading...</span>
                </div>
              )}
              {searched && !loading && images.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <p>No images found for "{query}"</p>
                </div>
              )}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 ${
                        selectedIds.has(img.id) ? 'border-red-600' : 'border-transparent'
                      }`}
                      onClick={() => toggleSelection(img.id)}
                    >
                      <img src={img.imageUrl} alt={img.title || 'Pinterest image'} className="w-full h-full object-cover" />
                      {selectedIds.has(img.id) && (
                        <div className="absolute top-1 right-1 bg-red-600 rounded-full p-1 text-white text-xs">✓</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedIds.size > 0 && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-gray-600">{selectedIds.size} image(s) selected</span>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  {importing ? '...' : 'Import Selected'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}