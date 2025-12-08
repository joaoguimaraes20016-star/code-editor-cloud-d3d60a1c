import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

// Common emojis organized by category
const EMOJI_CATEGORIES = {
  'Common': ['🚀', '💰', '🎯', '⭐', '💡', '🔥', '✨', '💪', '🏆', '📈', '💼', '🎉'],
  'Business': ['📊', '💵', '🏢', '📱', '💻', '🤝', '📧', '📞', '🗓️', '📝', '✅', '❌'],
  'People': ['👤', '👥', '🧑‍💼', '👨‍💻', '👩‍💼', '🙋', '🤔', '😊', '😎', '🤩', '💁', '🙌'],
  'Objects': ['🎓', '📚', '🔧', '⚙️', '🔑', '🎁', '💎', '🏠', '🚗', '✈️', '🌍', '🎨'],
  'Arrows': ['➡️', '⬆️', '⬇️', '↗️', '↘️', '🔄', '▶️', '⏩', '🔜', '🔝', '📍', '🎯'],
};

interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string | undefined) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Common');

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
        >
          {value ? (
            <span className="text-lg">{value}</span>
          ) : (
            <Smile className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="space-y-2">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-1">
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
          
          {/* Emoji grid */}
          <div className="grid grid-cols-6 gap-1">
            {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-lg hover:bg-secondary"
                onClick={() => handleSelect(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
          
          {/* Clear button */}
          {value && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleClear}
            >
              Remove emoji
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
