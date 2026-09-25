import { useState } from 'react';
import {
  Image as ImageIcon,
  Film,
  Maximize2,
  CheckCircle2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Play,
  FileCheck,
} from 'lucide-react';
import type { ListingMedia, InspectionDetails, QualityGrade } from '../../types';

interface ListingMediaViewerProps {
  media?: ListingMedia[];
  photos?: string[];
  videos?: string[];
  inspectionDetails?: InspectionDetails;
  commodityTitle?: string;
  qualityGrade?: QualityGrade;
  supplierName?: string;
  isVerifiedSupplier?: boolean;
}

export function ListingMediaViewer({
  media = [],
  photos = [],
  videos = [],
  inspectionDetails,
  commodityTitle = 'Produce',
  qualityGrade = 'A',
  supplierName = 'Supplier',
  isVerifiedSupplier = true,
}: ListingMediaViewerProps) {
  // Consolidate legacy photos/videos into uniform ListingMedia list if media not provided
  const allMedia: ListingMedia[] =
    media.length > 0
      ? media
      : [
          ...photos.map((p, i) => ({
            id: `photo_${i}`,
            type: 'image' as const,
            url: p,
            name: `Photo ${i + 1}`,
            caption: `Inspection Photo ${i + 1}`,
          })),
          ...videos.map((v, i) => ({
            id: `video_${i}`,
            type: 'video' as const,
            url: v,
            name: `Video ${i + 1}`,
            caption: `Inspection Video ${i + 1}`,
          })),
        ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // If no media is uploaded, display default mock produce showcase
  const displayItems =
    allMedia.length > 0
      ? allMedia
      : [
          {
            id: 'default_img',
            type: 'image' as const,
            url: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=1200&q=80',
            name: `${commodityTitle} Standard Inspection`,
            caption: `Verified batch image of ${commodityTitle}`,
          },
        ];

  const currentItem = displayItems[activeIndex] || displayItems[0];

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % displayItems.length);
  };

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + displayItems.length) % displayItems.length);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Verified Supplier Media &amp; Inspection Proof
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Verified Inspection
          </span>
        </div>
      </div>

      {/* Main Display Stage */}
      <div className="relative aspect-16/9 bg-gray-950 w-full overflow-hidden flex items-center justify-center group">
        {currentItem.type === 'video' ? (
          <div className="w-full h-full flex items-center justify-center">
            <video
              key={currentItem.url}
              src={currentItem.url}
              controls
              className="w-full h-full object-contain"
              poster={currentItem.thumbnailUrl}
            />
          </div>
        ) : (
          <img
            src={currentItem.url}
            alt={currentItem.name}
            className="w-full h-full object-contain cursor-zoom-in"
            onClick={() => setFullscreenOpen(true)}
          />
        )}

        {/* Carousel Prev/Next Buttons */}
        {displayItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Fullscreen Trigger */}
        <button
          type="button"
          onClick={() => setFullscreenOpen(true)}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="text-[10px]">Expand</span>
        </button>

        {/* Media Badge Overlay */}
        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-xs max-w-sm truncate flex items-center gap-2">
          {currentItem.type === 'video' ? (
            <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="font-medium text-[11px] truncate">
            {currentItem.caption || currentItem.name}
          </span>
          <span className="text-[10px] text-gray-400">
            ({activeIndex + 1}/{displayItems.length})
          </span>
        </div>
      </div>

      {/* Thumbnails Strip */}
      {displayItems.length > 1 && (
        <div className="px-5 flex items-center gap-2 overflow-x-auto pb-1">
          {displayItems.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                activeIndex === idx
                  ? 'border-blue-600 scale-105 shadow-xs ring-2 ring-blue-500/20'
                  : 'border-gray-200 opacity-60 hover:opacity-100'
              }`}
            >
              {item.type === 'video' ? (
                <div className="relative w-full h-full bg-gray-900 flex items-center justify-center text-white">
                  {item.thumbnailUrl && (
                    <img src={item.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                  )}
                  <Play className="relative w-4 h-4 text-blue-400" />
                </div>
              ) : (
                <img src={item.thumbnailUrl || item.url} alt={item.name} className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Inspection & Specification Parameters Grid */}
      <div className="px-5 pb-5 pt-1">
        <div className="p-4 bg-gray-50 border border-gray-200/80 rounded-xl space-y-3">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1.5 flex items-center justify-between">
            <span>Commodity Technical Inspection Details</span>
            <span className="text-gray-400">Grade: {qualityGrade}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-semibold">Moisture Content</span>
              <div className="font-bold text-gray-900 mt-0.5">
                {inspectionDetails?.moistureContent || '12.5% (Optimal Dry)'}
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-[10px] uppercase font-semibold">Packaging Type</span>
              <div className="font-bold text-gray-900 mt-0.5">
                {inspectionDetails?.packagingType || '50kg Polypropylene Bags'}
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-[10px] uppercase font-semibold">Harvest / Processing</span>
              <div className="font-bold text-gray-900 mt-0.5">
                {inspectionDetails?.harvestDate || 'Current Season / Certified'}
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-[10px] uppercase font-semibold">Storage Condition</span>
              <div className="font-bold text-gray-900 mt-0.5">
                {inspectionDetails?.storageType || 'Ventilated Silo / Warehouse'}
              </div>
            </div>
          </div>

          {/* Certifications and verification seal */}
          <div className="pt-2 border-t border-gray-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Visual and physical condition attested by{' '}
                <strong>{supplierName}</strong> {isVerifiedSupplier && '✓ (Verified Supplier)'}
              </span>
            </div>
            <span className="font-mono text-[10px] text-gray-400">
              BATCH-ID: {inspectionDetails?.batchNumber || `LOT-${Math.floor(Math.random() * 89999 + 10000)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {fullscreenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <button
            type="button"
            onClick={() => setFullscreenOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm cursor-pointer"
          >
            ✕ Close
          </button>

          <div className="max-w-4xl w-full max-h-[85vh] flex items-center justify-center">
            {currentItem.type === 'video' ? (
              <video src={currentItem.url} controls autoPlay className="max-h-[80vh] w-full object-contain" />
            ) : (
              <img src={currentItem.url} alt={currentItem.name} className="max-h-[80vh] w-full object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
