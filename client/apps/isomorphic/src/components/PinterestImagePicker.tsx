'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@core/modal-views/modal';
import { pinterestService, ImageSearchResult } from '@/services/pinterest.service';
import { uploadService, UploadedImage } from '@/services/upload.service';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface PinterestImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onImagesSelected: (images: UploadedImage[]) => void;
  initialSearch?: string;
}

export default function PinterestImagePicker({
  isOpen,
  onClose,
  onImagesSelected,
  initialSearch = '',
}: PinterestImagePickerProps) {
  const { data: session } = useSession();
  const [query, setQuery] = useState(initialSearch);
  const [images, setImages] = useState<ImageSearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [importing, setImporting] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [configMessage, setConfigMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    pinterestService
      .checkStatus()
      .then((s) => {
        setConfigured(s.configured);
        setConfigMessage(s.message);
        // Auto-search when modal opens with an initial query
        if (s.configured && initialSearch.trim()) {
          setQuery(initialSearch);
          runSearch(initialSearch);
        }
      })
      .catch(() => {
        setConfigured(false);
        setConfigMessage('Could not reach the server.');
      });
  }, [isOpen]);

  const runSearch = async (q: string) => {
    setLoading(true);
    setSearched(true);
    setSelectedIds(new Set());
    try {
      const result = await pinterestService.search(q.trim(), 30);
      setImages(result.results);
    } catch (error: any) {
      toast.error(error.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (query.trim()) runSearch(query.trim());
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    const token = session?.user?.token;
    if (!token) {
      toast.error('Please sign in to import images');
      return;
    }

    setImporting(true);
    try {
      const urls = images
        .filter((img) => selectedIds.has(img.id))
        .map((img) => img.imageUrl);

      const response = await uploadService.importFromUrls(urls, token);

      if (response.data.length > 0) {
        const uploadedImages: UploadedImage[] = response.data.map((img, idx) => ({
          url: img.url,
          publicId: img.publicId,
          thumbnail: img.thumbnail,
          isPrimary: idx === 0,
        }));
        onImagesSelected(uploadedImages);
        handleClose();
        toast.success(`${uploadedImages.length} image(s) imported`);
      } else {
        toast.error('Failed to import any images');
      }
    } catch (error: any) {
      toast.error(error.message || 'Import failed');
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
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold">Search Images</h2>
            <p className="text-xs text-gray-400 mt-0.5">Powered by Pinterest</p>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Not configured */}
        {configured === false && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-gray-500 max-w-sm">{configMessage}</p>
            <a
              href="https://developers.pinterest.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 text-sm text-red-600 underline"
            >
              Get your Pinterest access token →
            </a>
          </div>
        )}

        {/* Configured */}
        {configured === true && (
          <div className="flex flex-col" style={{ maxHeight: '75vh' }}>
            {/* Search bar */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search for images..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40"
              >
                {loading ? '...' : 'Search'}
              </button>
            </div>

            {/* Results area */}
            <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[420px]">
              {!searched && !loading && (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Enter a search term to find images
                </div>
              )}
              {loading && (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Searching...
                </div>
              )}
              {searched && !loading && images.length === 0 && (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  No images found for "{query}"
                </div>
              )}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img) => {
                    const selected = selectedIds.has(img.id);
                    return (
                      <div
                        key={img.id}
                        onClick={() => toggleSelection(img.id)}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={img.thumbUrl}
                          alt={img.title || 'Image'}
                          className="w-full h-full object-cover"
                        />
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center text-white text-xs font-bold">
                            ✓
                          </div>
                        )}
                        {img.credit && (
                          <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] px-1 py-0.5 truncate">
                            {img.credit}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedIds.size > 0 && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40"
                >
                  {importing ? 'Importing...' : `Import ${selectedIds.size} image${selectedIds.size > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading status check */}
        {configured === null && (
          <div className="flex items-center justify-center min-h-[200px] text-gray-400 text-sm">
            Loading...
          </div>
        )}
      </div>
    </Modal>
  );
}
