import type { Format } from './core/types';

const OOXML_TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  docm: 'application/vnd.ms-word.document.macroEnabled.12',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
};

export function extension(name: string): string {
  const m = name.match(/\.([A-Za-z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : '';
}

/** "Kontoauszug.pdf" → "Kontoauszug (entsperrt).pdf" */
export function outputName(name: string, suffix: string, format: Format): string {
  const ext = extension(name);
  const base = ext ? name.slice(0, -(ext.length + 1)) : name;
  const fallbackExt = format === 'pdf' ? 'pdf' : format === 'zip' ? 'zip' : 'docx';
  return `${base || 'file'} (${suffix}).${ext || fallbackExt}`;
}

export function outputMimeType(name: string, format: Format): string {
  if (format === 'pdf') return 'application/pdf';
  if (format === 'zip') return 'application/zip';
  return OOXML_TYPES[extension(name)] ?? 'application/octet-stream';
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
