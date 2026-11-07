export const occasionFileAccept = '.pdf,.docx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.webp';
export function validateOccasionAttachment(file?: File): string | null {
  if (!file) return null;
  const extension = file.name.split('.').pop()?.toLowerCase();
  const image = ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '');
  if (!image && !['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt'].includes(extension || '')) return 'Choose a supported PDF, Word, Excel, CSV, text file or JPEG, PNG or WebP photo.';
  if (!file.size) return 'This file is empty. Choose another file or paste your list.';
  if (image && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) return 'Choose a JPEG, PNG or WebP photo up to 5 MB.';
  if (file.size > 8 * 1024 * 1024) return 'Choose a document up to 8 MB.';
  return null;
}
export function isOccasionImage(file: File) { return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type); }
