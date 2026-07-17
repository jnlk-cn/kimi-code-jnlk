import type { PromptAttachment } from '../shared/contracts';

type FileWithPath = File & { readonly path?: string };

export function attachmentKindForFile(file: File): PromptAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

/** True when the file has a usable absolute path (Electron) or media bytes (dataUrl). */
export function canAttachFile(file: File): boolean {
  const path = (file as FileWithPath).path;
  if (typeof path === 'string' && path.length > 0 && (path.includes('/') || path.includes('\\'))) {
    return true;
  }
  const kind = attachmentKindForFile(file);
  return kind === 'image' || kind === 'video';
}

export async function fileToAttachment(file: File): Promise<PromptAttachment> {
  const path = (file as FileWithPath).path ?? file.name;
  const kind = attachmentKindForFile(file);
  const dataUrl = kind === 'file' ? undefined : await readDataUrl(file);
  return { kind, name: file.name, path, dataUrl };
}

export function filesFromDataTransfer(dataTransfer: DataTransfer): File[] {
  return Array.from(dataTransfer.files).filter((file) => file.size >= 0 && file.name.length > 0);
}

export function imageFilesFromClipboard(clipboardData: DataTransfer): File[] {
  const files: File[] = [];
  for (const item of Array.from(clipboardData.items)) {
    if (!item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file !== null) files.push(file);
  }
  return files;
}

export function mergeAttachments(
  current: readonly PromptAttachment[],
  next: readonly PromptAttachment[],
): PromptAttachment[] {
  return [
    ...current,
    ...next.filter((candidate) => current.every((item) => item.path !== candidate.path)),
  ];
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolveRead, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment.'));
    reader.onload = () => resolveRead(String(reader.result));
    reader.readAsDataURL(file);
  });
}
