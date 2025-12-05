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
  isBasicPlan?: boolean;
  isGenerating?: boolean;
}

export const ImageGallery = ({ slots, onDownload, onImageClick, onDelete, isBasicPlan = false, isGenerating = false }: ImageGalleryProps) => {
  if (slots.length === 0) return null;

  // Find first loading slot index
  const firstLoadingIndex = slots.findIndex(s => s.status === "loading");
  // Find first pending slot that would be "waiting" (next in queue after loading)
  const getWaitingIndex = () => {
    if (!isBasicPlan || !isGenerating) return -1;
    // For Basic: only 1 concurrent, so the next pending after first loading is waiting
    if (firstLoadingIndex === -1) return -1;
    return slots.findIndex((s, i) => i > firstLoadingIndex && s.status === "pending");
  };
  const waitingIndex = getWaitingIndex();

  // Get indices of slots that are in queue (pending but not the "waiting for pro" slot)
  const isSlotInQueue = (index: number, status: ImageSlotStatus) => {
    if (!isGenerating || status !== "pending") return false;
    if (isBasicPlan && index === waitingIndex) return false; // This one shows the Pro message
    // Check if there's at least one loading slot - if so, other pending slots are in queue
    return firstLoadingIndex !== -1 && index > firstLoadingIndex;
  };

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
            isWaitingForPro={index === waitingIndex}
            isInQueue={isSlotInQueue(index, slot.status)}
          />
        ))}
      </div>
    </div>
  );
};
