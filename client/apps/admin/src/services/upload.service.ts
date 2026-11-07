import { readJson, readError } from './response';
// Services for upload API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface UploadedImage {
  url: string;
  publicId: string;
  thumbnail: string;
  isPrimary: boolean;
}

interface UploadImageResponse {
  success: boolean;
  message: string;
  data: {
    url: string;
    publicId: string;
    resourceType: string;
    format: string;
    width: number;
    height: number;
    size: number;
    thumbnail: string;
  };
}

interface UploadMultipleResponse {
  success: boolean;
  message: string;
  data: Array<{
    url: string;
    publicId: string;
    resourceType: string;
    format: string;
    width: number;
    height: number;
    size: number;
    thumbnail: string;
  }>;
}

export const uploadService = {
  /**
   * Upload single image
   */
  async uploadImage(file: File, token: string, folder: string = 'products'): Promise<UploadImageResponse> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);

    const response = await fetch(`${API_URL}/api/uploads/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to upload image');
    }

    return readJson(response);
  },

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(files: File[], token: string, folder: string = 'products'): Promise<UploadMultipleResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });
    formData.append('folder', folder);

    const response = await fetch(`${API_URL}/api/uploads/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to upload images');
    }

    return readJson(response);
  },

  /**
   * Upload product gallery images
   */
  async uploadProductGallery(files: File[], token: string, productId?: string): Promise<UploadMultipleResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });
    formData.append('folder', 'products/gallery');
    if (productId) {
      formData.append('productId', productId);
    }

    const response = await fetch(`${API_URL}/api/uploads/product-gallery`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to upload gallery images');
    }

    return readJson(response);
  },

  /**
   * Import images from remote URLs (e.g., Pinterest) via server-side Cloudinary upload
   */
  async importFromUrls(urls: string[], token: string): Promise<{ success: boolean; count: number; data: Array<{ url: string; publicId: string; thumbnail: string }> }> {
    const response = await fetch(`${API_URL}/api/pinterest/import-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ urls }),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to import images');
    }

    return readJson(response);
  },

  /**
   * Delete image from Cloudinary
   */
  async deleteImage(publicId: string, token: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/uploads/image/${encodeURIComponent(publicId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to delete image');
    }
  },

  /**
   * Delete multiple images
   */
  async deleteMultipleImages(publicIds: string[], token: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/uploads/images/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ publicIds }),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to delete images');
    }
  },
};
