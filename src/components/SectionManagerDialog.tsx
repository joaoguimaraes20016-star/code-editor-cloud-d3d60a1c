import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconPicker } from "./IconPicker";

interface AssetCategory {
  id: string;
  label: string;
  icon: string;
  order_index: number;
}

interface SectionManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: AssetCategory | null;
  onSave: (category: Omit<AssetCategory, "order_index">) => void;
  onDelete?: () => void;
}

export function SectionManagerDialog({ 
  open, 
  onOpenChange, 
  category, 
  onSave, 
  onDelete 
}: SectionManagerDialogProps) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("BookOpen");

  useEffect(() => {
    if (category) {
      setLabel(category.label);
      setIcon(category.icon);
    } else {
      setLabel("");
      setIcon("BookOpen");
    }
  }, [category, open]);

  const handleSave = () => {
    if (!label.trim()) return;
    
    const id = category?.id || label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    
    onSave({ id, label: label.trim(), icon });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Section" : "Add Section"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="label">Section Name</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Training, Scripts, Resources"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
        </div>
        
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {category && onDelete && (
            <Button 
              variant="destructive" 
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
            >
              Delete Section
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!label.trim()}>
              {category ? "Save Changes" : "Add Section"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
