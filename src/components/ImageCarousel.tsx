import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageCarouselProps {
  images: string[];
  aspectRatio?: 'square' | 'video' | 'auto';
  showThumbnails?: boolean;
  enableZoom?: boolean;
  className?: string;
}

export default function ImageCarousel({ 
  images = [], // Default to empty array
  aspectRatio = 'square', 
  showThumbnails = true,
  enableZoom = false,
  className = ''
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  // Filter out empty/invalid URLs
  const validImages = images.filter(url => url && typeof url === 'string' && url.startsWith('http'));
  
  // Reset index if it goes out of bounds
  useEffect(() => {
    if (currentIndex >= validImages.length && validImages.length > 0) {
      setCurrentIndex(0);
    }
  }, [validImages.length, currentIndex]);

  // Handle image load error
  const handleImageError = (index: number) => {
    setFailedImages(prev => new Set(prev).add(index));
  };

  // Check if current image failed
  const isCurrentImageFailed = failedImages.has(currentIndex);
  
  // If no valid images, show placeholder
  if (validImages.length === 0 || isCurrentImageFailed) {
    return (
      <div className={`bg-gray-100 rounded-lg flex flex-col items-center justify-center ${className}`} style={{ aspectRatio: aspectRatio === 'square' ? '1/1' : aspectRatio === 'video' ? '16/9' : 'auto' }}>
        <ImageIcon className="w-16 h-16 text-gray-300 mb-2" />
        <span className="text-gray-400 text-sm">No image available</span>
      </div>
    );
  }

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    auto: 'aspect-auto'
  };

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
    setIsZoomed(false);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
    setIsZoomed(false);
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
    setIsZoomed(false);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Image Container */}
      <div className={`relative ${aspectClasses[aspectRatio]} bg-gray-100 rounded-xl overflow-hidden group`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            <img
              src={validImages[currentIndex]}
              alt={`Image ${currentIndex + 1}`}
              className={`w-full h-full object-cover transition-transform duration-300 ${isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`}
              onClick={() => enableZoom && setIsZoomed(!isZoomed)}
              onError={() => handleImageError(currentIndex)}
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {validImages.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </>
        )}

        {/* Zoom Indicator */}
        {enableZoom && !isZoomed && (
          <div className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm z-10">
            <ZoomIn className="w-4 h-4 text-gray-600" />
          </div>
        )}

        {/* Image Counter */}
        <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-sm text-white text-sm rounded-full z-10">
          {currentIndex + 1} / {validImages.length}
        </div>
      </div>

      {/* Thumbnails */}
      {showThumbnails && validImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {validImages.map((image, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                index === currentIndex ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-transparent hover:border-gray-300'
              }`}
            >
              <img 
                src={image} 
                alt={`Thumbnail ${index + 1}`} 
                className="w-full h-full object-cover"
                onError={() => handleImageError(index)}
              />
              {failedImages.has(index) && (
                <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}