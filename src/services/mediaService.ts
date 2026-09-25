import type { ListingMedia } from '../types';
import { apiFetch } from '../lib/api';

// Backed by the /api/media endpoints (issue #32). Files go straight from
// the browser to the storage bucket via a presigned URL -- never through
// the API or into localStorage -- then the API is told the upload finished
// so it can verify it and generate WebP renditions / video thumbnails.

const API_BASE = import.meta.env.VITE_API_URL || '';

interface PresignResponse {
  mediaId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

// Media URLs from the API are same-origin `/api/media/:id/content` paths;
// prefix them the same way apiFetch prefixes endpoints.
export function resolveMediaUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.startsWith('/api/') ? `${API_BASE}${url}` : url;
}

export function normalizeMedia(raw: any): ListingMedia {
  return {
    id: raw.id,
    type: raw.type,
    url: resolveMediaUrl(raw.url) as string,
    thumbnailUrl: resolveMediaUrl(raw.thumbnailUrl ?? undefined),
    name: raw.name,
    size: raw.size,
    caption: raw.caption ?? undefined,
    uploadedAt: raw.uploadedAt,
    status: raw.status,
    isCover: raw.isCover,
    sortOrder: raw.sortOrder,
    processingError: raw.processingError ?? undefined,
  };
}

// XHR rather than fetch: fetch has no upload progress events.
function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (storage returned ${xhr.status}).`));
    xhr.onerror = () => reject(new Error('Upload failed -- check your connection and try again.'));
    xhr.send(file);
  });
}

export const mediaService = {
  // Presign → upload to the bucket → confirm. Resolves with the server's
  // record (status `processing`; renditions follow shortly). Pass
  // `listingId` to attach to an existing listing; without it, pass the
  // returned id in `mediaIds` when creating the listing.
  async upload(
    file: File,
    opts: { listingId?: string; onProgress?: (fraction: number) => void } = {},
  ): Promise<ListingMedia> {
    const presign = await apiFetch<PresignResponse>('/api/media/presigned-url', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        listingId: opts.listingId,
      }),
    });
    await putWithProgress(presign.uploadUrl, file, presign.headers, opts.onProgress);
    const raw = await apiFetch<any>(`/api/media/${presign.mediaId}/complete`, { method: 'POST' });
    return normalizeMedia(raw);
  },

  async get(id: string): Promise<ListingMedia> {
    return normalizeMedia(await apiFetch<any>(`/api/media/${id}`));
  },

  async update(id: string, patch: { caption?: string; isCover?: boolean; sortOrder?: number }): Promise<ListingMedia> {
    return normalizeMedia(
      await apiFetch<any>(`/api/media/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    );
  },

  async remove(id: string): Promise<void> {
    await apiFetch(`/api/media/${id}`, { method: 'DELETE' });
  },
};
