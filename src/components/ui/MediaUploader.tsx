import { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Film,
  X,
  Play,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { ListingMedia, CommodityType } from '../../types';
import { mediaService } from '../../services/mediaService';

interface MediaUploaderProps {
  media: ListingMedia[];
  onChange: (media: ListingMedia[]) => void;
  commodity?: CommodityType;
  maxFiles?: number;
  // Attach uploads straight to an existing listing (edit flows). Without
  // it, uploads wait to be attached via `mediaIds` when the listing is
  // created.
  listingId?: string;
}

export function MediaUploader({
  media = [],
  onChange,
  maxFiles = 8,
  listingId,
}: MediaUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<ListingMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Uploads finish asynchronously, after the `media` prop captured by the
  // closure that started them is stale -- always patch the latest list.
  // Several patches can land before the parent re-renders (two uploads
  // finishing, a poll result), so each one advances the ref itself;
  // otherwise the later patch is built on the old list and drops the first.
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const commit = (next: ListingMedia[]) => {
    mediaRef.current = next;
    onChange(next);
  };
  const patchItem = (id: string, patch: Partial<ListingMedia>) => {
    commit(mediaRef.current.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  // Poll items the server is still processing until they're ready/failed,
  // so a rejected file is flagged before the listing is published.
  useEffect(() => {
    const processing = media.filter((m) => m.status === 'processing');
    if (processing.length === 0) return;
    const timer = setTimeout(async () => {
      for (const item of processing) {
        try {
          const fresh = await mediaService.get(item.id);
          if (fresh.status !== 'processing') {
            // Keep the local preview; the server URL may not be cached yet.
            patchItem(item.id, { status: fresh.status, processingError: fresh.processingError });
          }
        } catch {
          // Transient -- try again on the next tick.
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [media]);

  const startUpload = async (localId: string, file: File) => {
    try {
      const saved = await mediaService.upload(file, {
        listingId,
        onProgress: (progress) => patchItem(localId, { progress }),
      });
      // Swap the local placeholder id for the server's, keeping the blob
      // preview so the thumbnail doesn't flicker.
      patchItem(localId, {
        id: saved.id,
        status: saved.status,
        progress: 1,
        processingError: saved.processingError,
        isCover: saved.isCover,
      });
    } catch (e) {
      patchItem(localId, {
        status: 'failed',
        processingError: e instanceof Error ? e.message : 'Upload failed.',
      });
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const newItems: ListingMedia[] = [];
    const queued: [string, File][] = [];

    Array.from(files).forEach((file) => {
      if (media.length + newItems.length >= maxFiles) {
        setError(`Maximum of ${maxFiles} media items allowed.`);
        return;
      }

      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isImage && !isVideo) {
        setError('Only image files (JPG, PNG, WebP) and video files (MP4, WebM, MOV) are supported.');
        return;
      }

      // Check sizes: 20MB for images, 80MB for videos
      const maxSize = isVideo ? 80 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`${file.name} is too large. Max size is ${isVideo ? '80MB' : '20MB'}.`);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      newItems.push({
        id: localId,
        type: isVideo ? 'video' : 'image',
        url: objectUrl,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        caption: isVideo ? 'Uploaded inspection video' : 'Uploaded batch photo',
        status: 'uploading',
        progress: 0,
      });
      queued.push([localId, file]);
    });

    if (newItems.length > 0) {
      commit([...mediaRef.current, ...newItems]);
      queued.forEach(([localId, file]) => startUpload(localId, file));
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = mediaRef.current.find((m) => m.id === id);
    commit(mediaRef.current.filter((m) => m.id !== id));
    if (selectedPreview?.id === id) {
      setSelectedPreview(null);
    }
    // Already on the server: delete it there too, so it isn't left in the
    // bucket. (An upload still in flight is cleaned up server-side later.)
    if (item && item.status !== 'uploading' && !id.startsWith('local_')) {
      mediaService.remove(id).catch(() => {
        // Unattached uploads are purged server-side after 24h anyway.
      });
    }
  };

  // The server's cover when it has one; otherwise the first uploaded photo,
  // which is the one the server picks (on create, or when the cover is
  // removed from an existing listing).
  const canBeCover = (m: ListingMedia) => m.type === 'image' && (m.status === 'processing' || m.status === 'ready');
  const explicitCover = media.findIndex((m) => m.isCover);
  const coverIndex = explicitCover >= 0 ? explicitCover : media.findIndex(canBeCover);

  const handleSetCover = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    try {
      await mediaService.update(id, { isCover: true });
      commit(mediaRef.current.map((m) => ({ ...m, isCover: m.id === id })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the cover photo.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-900">
          Produce Photos &amp; Inspection Videos
        </label>
        <p className="text-[11px] text-gray-500">
          Upload high-resolution pictures and video clips of the harvest, bags, and warehouse.
        </p>
      </div>

      {/* Drag & Drop Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-agri-600 bg-agri-50/50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-agri-100 flex items-center justify-center text-agri-700">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
            <Film className="w-5 h-5" />
          </div>
        </div>

        <p className="text-xs font-semibold text-gray-800">
          Click or drag images &amp; videos here to upload
        </p>
        <p className="text-[11px] text-gray-500 mt-1">
          Supports JPG, PNG, WEBP (up to 20MB) and MP4, WEBM, MOV (up to 80MB)
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Media Gallery Grid */}
      {media.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-600">
            Uploaded Media ({media.length}/{maxFiles})
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {media.map((item, index) => (
              <div
                key={item.id}
                onClick={() => setSelectedPreview(item)}
                className="group relative rounded-xl border border-gray-200 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer aspect-4/3 flex flex-col"
              >
                {/* Media Item Visual */}
                <div className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden">
                  {item.type === 'video' ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <video
                        src={item.url}
                        className="w-full h-full object-cover opacity-80"
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-white/90 text-gray-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-4 h-4 ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                        <Film className="w-3 h-3 text-blue-400" />
                        Video
                      </span>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {/* Upload / processing status */}
                  {item.status === 'uploading' && (
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.round((item.progress ?? 0) * 100)}%` }}
                      />
                    </div>
                  )}
                  {(item.status === 'uploading' || item.status === 'processing') && (
                    <span className="absolute top-2 left-2 mt-6 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {item.status === 'uploading'
                        ? `Uploading ${Math.round((item.progress ?? 0) * 100)}%`
                        : 'Processing'}
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <div className="absolute inset-0 bg-red-900/75 flex flex-col items-center justify-center p-2 text-center">
                      <AlertCircle className="w-5 h-5 text-white mb-1" />
                      <span className="text-[10px] font-semibold text-white leading-tight">
                        {item.processingError || 'Upload failed.'}
                      </span>
                      <span className="text-[9px] text-red-100 mt-1">Remove and try again</span>
                    </div>
                  )}

                  {index === coverIndex && (
                    <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-bold uppercase tracking-wider">
                      Primary Cover
                    </span>
                  )}
                  {/* Only attached media can be the cover, so only on an existing listing */}
                  {listingId && index !== coverIndex && canBeCover(item) && (
                    <button
                      type="button"
                      onClick={(e) => handleSetCover(item.id, e)}
                      className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 hover:bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                    >
                      Set as cover
                    </button>
                  )}

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(item.id, e)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Footer caption */}
                {item.caption && (
                  <div className="p-1.5 bg-white border-t border-gray-100 text-[10px] text-gray-600 truncate">
                    {item.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative max-w-2xl w-full bg-gray-950 rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
            <div className="flex items-center justify-between p-3 border-b border-gray-800 text-white">
              <div className="text-xs font-semibold truncate max-w-sm">
                {selectedPreview.caption || selectedPreview.name}
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[65vh] flex items-center justify-center bg-black">
              {selectedPreview.type === 'video' ? (
                <video
                  src={selectedPreview.url}
                  controls
                  autoPlay
                  className="w-full max-h-[60vh] object-contain"
                />
              ) : (
                <img
                  src={selectedPreview.url}
                  alt={selectedPreview.name}
                  className="w-full max-h-[60vh] object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

