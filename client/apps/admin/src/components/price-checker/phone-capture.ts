import { validBarcode } from './scanner';

// These proportions match the guide drawn over the preview. Capture the frame
// synchronously so turning to a different bottle while it decodes changes nothing.
export async function readPhoneFrame(video: HTMLVideoElement): Promise<string | null> {
  const width = Math.floor(video.videoWidth * .88);
  const height = Math.floor(video.videoHeight * .52);
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1100 / width);
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(video, (video.videoWidth - width) / 2, (video.videoHeight - height) / 2,
    width, height, 0, 0, canvas.width, canvas.height);
  const frame = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
  if (!frame) return null;

  const { Html5Qrcode, Html5QrcodeSupportedFormats: format } = await import('html5-qrcode');
  const container = document.createElement('div');
  container.hidden = true;
  container.id = `phone-capture-${crypto.randomUUID()}`;
  document.body.append(container);
  const reader = new Html5Qrcode(container.id, {
    formatsToSupport: [format.EAN_13, format.EAN_8, format.UPC_A, format.UPC_E, format.CODE_128, format.CODE_39],
    useBarCodeDetectorIfSupported: true,
    verbose: false,
  });
  try {
    const value = await reader.scanFile(new File([frame], 'barcode.png', { type: 'image/png' }), false);
    return validBarcode(value);
  } finally {
    try { reader.clear(); } finally { container.remove(); }
  }
}
