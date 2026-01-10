import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, Link as LinkIcon, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string) => void;
  currentImage?: string;
}

const sampleImages = [
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop',
  'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=400&fit=crop',
];

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  currentImage,
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState(currentImage || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = () => {
    if (!imageUrl.trim()) return;
    setSelectedImage(imageUrl);
    onSelectImage(imageUrl);
    toast.success('Image selected');
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // In a real app, you'd upload to storage here
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      onSelectImage(base64);
      toast.success('Image uploaded');
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (url: string) => {
    setSelectedImage(url);
    onSelectImage(url);
    toast.success('Image selected');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-builder-surface border-builder-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-builder-text flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-builder-accent" />
            Choose Image
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="w-full bg-builder-bg">
            <TabsTrigger value="upload" className="flex-1">Upload</TabsTrigger>
            <TabsTrigger value="url" className="flex-1">URL</TabsTrigger>
            <TabsTrigger value="library" className="flex-1">Library</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="py-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-builder-border rounded-xl p-8 text-center cursor-pointer hover:border-builder-accent/50 hover:bg-builder-surface-hover transition-all"
            >
              <Upload className="w-10 h-10 text-builder-text-muted mx-auto mb-3" />
              <p className="text-sm text-builder-text">Click to upload an image</p>
              <p className="text-xs text-builder-text-dim mt-1">PNG, JPG, GIF up to 10MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </TabsContent>

          <TabsContent value="url" className="py-4 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-builder-text-muted" />
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="builder-input pl-10"
                />
              </div>
              <Button
                onClick={handleUrlSubmit}
                className="bg-builder-accent text-white hover:brightness-110"
              >
                Add
              </Button>
            </div>
            {imageUrl && (
              <div className="aspect-video bg-builder-bg rounded-lg overflow-hidden">
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                  onError={() => toast.error('Failed to load image')}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="py-4">
            <div className="grid grid-cols-2 gap-3">
              {sampleImages.map((url, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSample(url)}
                  className="aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-builder-accent transition-all relative group"
                >
                  <img src={url} alt={`Sample ${index + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
