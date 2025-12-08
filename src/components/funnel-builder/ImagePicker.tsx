import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, Image as ImageIcon, Search, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  aspectRatio?: 'S' | 'M' | 'L' | 'XL';
}

const ASPECT_RATIOS = {
  S: { ratio: '16/9', label: 'S (16:9)' },
  M: { ratio: '4/3', label: 'M (4:3)' },
  L: { ratio: '5/4', label: 'L (5:4)' },
  XL: { ratio: '1/1', label: 'XL (1:1)' },
};

export function ImagePicker({ open, onOpenChange, onSelect, aspectRatio = 'M' }: ImagePickerProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'unsplash'>('unsplash');
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSize, setSelectedSize] = useState<'S' | 'M' | 'L' | 'XL'>(aspectRatio);
  const [unsplashImages, setUnsplashImages] = useState<{ id: string; url: string; thumb: string; author: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchUnsplash = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      // Using Unsplash source for free images (no API key needed)
      // In production, you'd use the proper API with an access key
      const mockResults = Array.from({ length: 12 }, (_, i) => ({
        id: `${query}-${i}`,
        url: `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}&sig=${i}`,
        thumb: `https://source.unsplash.com/200x150/?${encodeURIComponent(query)}&sig=${i}`,
        author: 'Unsplash Contributor',
      }));
      
      setUnsplashImages(mockResults);
    } catch (error) {
      console.error('Unsplash search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSubmitUrl = () => {
    if (urlInput.trim()) {
      onSelect(urlInput.trim());
      onOpenChange(false);
      setUrlInput('');
    }
  };

  const handleSelectUnsplash = (url: string) => {
    onSelect(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Image</DialogTitle>
        </DialogHeader>

        {/* Size Selector */}
        <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg w-fit">
          {(Object.keys(ASPECT_RATIOS) as Array<keyof typeof ASPECT_RATIOS>).map((size) => (
            <Button
              key={size}
              variant={selectedSize === size ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setSelectedSize(size)}
            >
              {size}
            </Button>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'url' | 'unsplash')} className="flex-1">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="url" className="gap-2">
              <Link className="h-4 w-4" />
              URL
            </TabsTrigger>
            <TabsTrigger value="unsplash" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Unsplash
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            
            {urlInput && (
              <div 
                className="border rounded-lg overflow-hidden"
                style={{ aspectRatio: ASPECT_RATIOS[selectedSize].ratio }}
              >
                <img 
                  src={urlInput} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
              </div>
            )}

            <Button onClick={handleSubmitUrl} disabled={!urlInput.trim()} className="w-full">
              Use Image
            </Button>
          </TabsContent>

          <TabsContent value="unsplash" className="space-y-4 flex-1">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search free photos..."
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      searchUnsplash(searchQuery);
                    }
                  }}
                />
              </div>
              <Button onClick={() => searchUnsplash(searchQuery)} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </Button>
            </div>

            {/* Drop zone */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drop image or click to browse folders
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max. 10MB; .png .jpg .webp .gif
              </p>
            </div>

            {/* Results grid */}
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : unsplashImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {unsplashImages.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => handleSelectUnsplash(image.url)}
                      className="relative group overflow-hidden rounded-lg border hover:ring-2 hover:ring-primary transition-all"
                      style={{ aspectRatio: ASPECT_RATIOS[selectedSize].ratio }}
                    >
                      <img
                        src={image.thumb}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-xs text-white truncate">{image.author}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Search Unsplash for free photos
                </div>
              )}
            </ScrollArea>

            <p className="text-xs text-muted-foreground text-center">
              Free photos from Unsplash - safe for commercial use
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
