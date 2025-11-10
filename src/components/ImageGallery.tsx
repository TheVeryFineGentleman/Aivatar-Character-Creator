import { ImageSlot, ImageSlotStatus } from "./ImageSlot";

export interface ImageSlotData {
  status: ImageSlotStatus;
  imageUrl?: string;
  progress?: number;
  retrying?: boolean;
}

interface ImageGalleryProps {
  slots: ImageSlotData[];
  onDownload: (index: number) => void;
  onImageClick?: (index: number) => void;
  onDelete?: (index: number) => void;
}

export const ImageGallery = ({ slots, onDownload, onImageClick, onDelete }: ImageGalleryProps) => {
  if (slots.length === 0) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Generierte Bilder</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {slots.map((slot, index) => (
          <ImageSlot
            key={index}
            index={index}
            status={slot.status}
            imageUrl={slot.imageUrl}
            progress={slot.progress}
            retrying={slot.retrying}
            onDownload={() => onDownload(index)}
            onImageClick={() => onImageClick?.(index)}
            onDelete={() => onDelete?.(index)}
          />
        ))}
      </div>
    </div>
  );
};
