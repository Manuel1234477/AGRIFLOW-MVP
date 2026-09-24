import { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Film,
  X,
  Play,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { ListingMedia, CommodityType } from '../../types';

interface MediaUploaderProps {
  media: ListingMedia[];
  onChange: (media: ListingMedia[]) => void;
  commodity?: CommodityType;
  maxFiles?: number;
}

// Curated high quality authentic agricultural demo media
const SAMPLE_MEDIA_LIBRARY: Record<
  string,
  { type: 'image' | 'video'; url: string; name: string; caption: string }[]
> = {
  maize: [
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=1200&q=80',
      name: 'Dry_Yellow_Maize_Batch_A.jpg',
      caption: 'Grade A Yellow Maize - Dried to 12.5% Moisture',
    },
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1596797882870-8c33deeac224?auto=format&fit=crop&w=1200&q=80',
      name: 'Clean_Grain_Inspection.jpg',
      caption: 'Close-up grain purity inspection (99.2% clean grain)',
    },
    {
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      name: 'Farm_Warehouse_Video_Proof.mp4',
      caption: 'Warehouse inspection video recording & bagging verification',
    },
  ],
  rice: [
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=80',
      name: 'Milled_Parboiled_Rice.jpg',
      caption: 'Standard Long Grain Parboiled Rice - 50kg Bags',
    },
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=1200&q=80',
      name: 'Rice_Paddy_Harvest.jpg',
      caption: 'Freshly harvested paddy before de-stoning and polishing',
    },
    {
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      name: 'Milling_Line_Video.mp4',
      caption: 'Automated de-stoning & bag sealing live video clip',
    },
  ],
  soybean: [
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=1200&q=80',
      name: 'Non_GMO_Soybeans.jpg',
      caption: 'Clean non-GMO Soybeans ready for oil extraction / feed milling',
    },
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=1200&q=80',
      name: 'Soybean_Quality_Test.jpg',
      caption: 'Batch laboratory moisture and protein certification',
    },
    {
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      name: 'Soybean_Loading_Video.mp4',
      caption: 'Palletized soybean loading inspection video',
    },
  ],
  general: [
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80',
      name: 'Farm_Produce_Storage.jpg',
      caption: 'A-Grade farm produce in ventilated dry storage',
    },
    {
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      name: 'Produce_Inspection_Clip.mp4',
      caption: 'Live batch quality & packaging inspection footage',
    },
  ],
};

export function MediaUploader({
  media = [],
  onChange,
  commodity = 'maize',
  maxFiles = 8,
}: MediaUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<ListingMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const newItems: ListingMedia[] = [];

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
      newItems.push({
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: isVideo ? 'video' : 'image',
        url: objectUrl,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        caption: isVideo ? 'Uploaded inspection video' : 'Uploaded batch photo',
      });
    });

    if (newItems.length > 0) {
      onChange([...media, ...newItems]);
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = media.filter((m) => m.id !== id);
    onChange(updated);
    if (selectedPreview?.id === id) {
      setSelectedPreview(null);
    }
  };

  const handleAddSamplePreset = () => {
    const samples = SAMPLE_MEDIA_LIBRARY[commodity] || SAMPLE_MEDIA_LIBRARY.general;
    const itemsToAdd: ListingMedia[] = samples.map((s, idx) => ({
      id: `sample_${commodity}_${Date.now()}_${idx}`,
      type: s.type,
      url: s.url,
      name: s.name,
      caption: s.caption,
      uploadedAt: new Date().toISOString(),
    }));

    // Avoid duplicates
    const existingUrls = new Set(media.map((m) => m.url));
    const filtered = itemsToAdd.filter((item) => !existingUrls.has(item.url));

    if (filtered.length > 0) {
      onChange([...media, ...filtered]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold text-gray-900">
            Produce Photos &amp; Inspection Videos
          </label>
          <p className="text-[11px] text-gray-500">
            Upload high-resolution pictures and video clips of the harvest, bags, and warehouse.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddSamplePreset}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          + Add Sample Produce Media
        </button>
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

                  {/* Primary Badge */}
                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-bold uppercase tracking-wider">
                      Primary Cover
                    </span>
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
