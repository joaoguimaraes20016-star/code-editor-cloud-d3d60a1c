import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { 
  BookOpen, Briefcase, FileText, Video, FileSpreadsheet, Users, 
  Folder, Star, Heart, Zap, Target, Trophy, Award, Gift,
  Lightbulb, Rocket, Flag, Bookmark, Tag, Calendar,
  Clock, Bell, Mail, MessageSquare, Phone, Globe,
  Settings, Lock, Key, Shield, Check, X as XIcon,
  Play, Pause, Music, Image, Camera, Film, Mic,
  Headphones, Radio, Tv, Monitor, Smartphone, Tablet,
  Laptop, HardDrive, Database, Server, Cloud, Wifi,
  Link, Share, Send, Download, Upload, Search,
  Home, Building, Map, Navigation, Compass, Anchor,
  Plane, Car, Train, Bus, Bike, Ship,
  Coffee, Pizza, Utensils, Wine, Beer, Cake,
  Sun, Moon, CloudRain, Snowflake, Wind, Thermometer,
  Smile, Frown, Meh, ThumbsUp, ThumbsDown, AlertCircle
} from "lucide-react";

const ICON_OPTIONS = [
  { name: "BookOpen", component: BookOpen },
  { name: "Briefcase", component: Briefcase },
  { name: "FileText", component: FileText },
  { name: "Video", component: Video },
  { name: "FileSpreadsheet", component: FileSpreadsheet },
  { name: "Users", component: Users },
  { name: "Folder", component: Folder },
  { name: "Star", component: Star },
  { name: "Heart", component: Heart },
  { name: "Zap", component: Zap },
  { name: "Target", component: Target },
  { name: "Trophy", component: Trophy },
  { name: "Award", component: Award },
  { name: "Gift", component: Gift },
  { name: "Lightbulb", component: Lightbulb },
  { name: "Rocket", component: Rocket },
  { name: "Flag", component: Flag },
  { name: "Bookmark", component: Bookmark },
  { name: "Tag", component: Tag },
  { name: "Calendar", component: Calendar },
  { name: "Clock", component: Clock },
  { name: "Bell", component: Bell },
  { name: "Mail", component: Mail },
  { name: "MessageSquare", component: MessageSquare },
  { name: "Phone", component: Phone },
  { name: "Globe", component: Globe },
  { name: "Settings", component: Settings },
  { name: "Lock", component: Lock },
  { name: "Key", component: Key },
  { name: "Shield", component: Shield },
  { name: "Check", component: Check },
  { name: "Play", component: Play },
  { name: "Music", component: Music },
  { name: "Image", component: Image },
  { name: "Camera", component: Camera },
  { name: "Film", component: Film },
  { name: "Mic", component: Mic },
  { name: "Headphones", component: Headphones },
  { name: "Monitor", component: Monitor },
  { name: "Smartphone", component: Smartphone },
  { name: "Laptop", component: Laptop },
  { name: "Database", component: Database },
  { name: "Cloud", component: Cloud },
  { name: "Link", component: Link },
  { name: "Share", component: Share },
  { name: "Send", component: Send },
  { name: "Download", component: Download },
  { name: "Upload", component: Upload },
  { name: "Search", component: Search },
  { name: "Home", component: Home },
  { name: "Building", component: Building },
  { name: "Map", component: Map },
  { name: "Coffee", component: Coffee },
  { name: "Sun", component: Sun },
  { name: "Moon", component: Moon },
  { name: "Smile", component: Smile },
  { name: "ThumbsUp", component: ThumbsUp },
  { name: "AlertCircle", component: AlertCircle },
];

export function getIconComponent(iconName: string) {
  const found = ICON_OPTIONS.find(i => i.name === iconName);
  return found?.component || BookOpen;
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const SelectedIcon = getIconComponent(value);
  
  const filteredIcons = ICON_OPTIONS.filter(icon => 
    icon.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <SelectedIcon className="h-4 w-4" />
          <span>{value || "Select icon"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <Input
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
          {filteredIcons.map(({ name, component: Icon }) => (
            <button
              key={name}
              type="button"
              className={`p-2 rounded hover:bg-muted transition-colors ${
                value === name ? "bg-primary/20 text-primary" : ""
              }`}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              title={name}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
