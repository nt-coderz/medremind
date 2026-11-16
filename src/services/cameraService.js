import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

/**
 * Checks and requests camera permissions on native devices.
 */
export async function ensureCameraPermissions() {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const status = await Camera.checkPermissions();
    if (status.camera === 'granted') {
      return true;
    }
    const requested = await Camera.requestPermissions({ permissions: ['camera'] });
    return requested.camera === 'granted';
  } catch (err) {
    console.warn('[CameraService] Permission check error:', err);
    return true; // Fall through to attempt getPhoto
  }
}

/**
 * Capture an image using Capacitor Camera on native Android,
 * or fallback to HTML file picker with capture attribute in browser.
 */
export async function capturePrescriptionImage(sourceType = 'camera') {
  try {
    if (sourceType === 'camera') {
      const hasPerm = await ensureCameraPermissions();
      if (!hasPerm) {
        return { success: false, error: 'Camera permission denied. Please enable camera access in app settings.' };
      }
    }

    // Attempt Capacitor Camera
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: sourceType === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      saveToGallery: false
    });

    if (!photo || !photo.dataUrl) {
      return { success: false, error: 'Cancelled' };
    }

    return {
      success: true,
      dataUrl: photo.dataUrl,
      format: photo.format || 'jpeg'
    };
  } catch (error) {
    // If user cancelled, don't trigger error alerts
    const msg = error?.message || String(error);
    if (msg.includes('cancelled') || msg.includes('User cancelled photos app')) {
      return { success: false, error: 'Cancelled' };
    }

    console.warn("Capacitor camera failed or unavailable, using web picker fallback:", error);

    // Web Fallback: Create dynamic file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (sourceType === 'camera') {
        input.capture = 'environment';
      }

      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve({ success: false, error: 'No image selected' });
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            success: true,
            dataUrl: reader.result,
            format: file.type.split('/')[1] || 'jpeg'
          });
        };
        reader.onerror = () => {
          resolve({ success: false, error: 'Failed to read image file' });
        };
        reader.readAsDataURL(file);
      };

      input.oncancel = () => {
        resolve({ success: false, error: 'Cancelled' });
      };

      input.click();
    });
  }
}
