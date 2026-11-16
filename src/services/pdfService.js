/**
 * MedRemind Client-Side PDF Processing Service
 * Uses pdfjs-dist to render PDF pages onto canvases and extract digital text.
 * Works 100% offline inside the Capacitor webview.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure offline worker from bundled public assets
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/**
 * Converts a base64 data URL to an ArrayBuffer
 * @param {string} dataUrl 
 * @returns {ArrayBuffer}
 */
export function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Extracts page count and renders each PDF page to a JPEG image data URL.
 * @param {ArrayBuffer|string} input - ArrayBuffer or dataUrl
 * @param {number} scale - render scale (default 1.5 for crisp OCR resolution)
 * @returns {Promise<{ pageCount: number, pages: Array<{ pageNumber: number, dataUrl: string, width: number, height: number }>, text: string }>}
 */
export async function processPdfDocument(input, scale = 1.5) {
  const data = typeof input === 'string' ? dataUrlToArrayBuffer(input) : input;
  
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages = [];
  let fullText = '';

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    // Render page to an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    const renderContext = {
      canvasContext: ctx,
      viewport
    };

    await page.render(renderContext).promise;

    // Convert canvas to JPEG data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Extract embedded text content
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += (pageNum > 1 ? '\n\n' : '') + pageText;

    pages.push({
      pageNumber: pageNum,
      dataUrl,
      width: viewport.width,
      height: viewport.height
    });
  }

  return {
    pageCount,
    pages,
    text: fullText.trim()
  };
}
