import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GripVertical, Trash2, UserCheck, UserCircle, XCircle } from "lucide-react";

interface ConfirmationConfig {
  sequence: number;
  hours_before: number;
  label: string;
  assigned_role: "setter" | "closer" | "off";
  enabled: boolean;
}

interface ConfirmationCardProps {
  confirmation: ConfirmationConfig;
  index: number;
  onUpdate: (index: number, field: keyof ConfirmationConfig, value: any) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function ConfirmationCard({
  confirmation,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: ConfirmationCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: confirmation.sequence });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "setter":
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            Setter
          </Badge>
        );
      case "closer":
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <UserCircle className="h-3 w-3" />
            Closer
          </Badge>
        );
      case "off":
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
            <XCircle className="h-3 w-3" />
            Off
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`transition-all ${!confirmation.enabled ? "opacity-60" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing mt-1"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex-1 space-y-4">
              {/* Header Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={confirmation.enabled}
                    onCheckedChange={(enabled) => onUpdate(index, "enabled", enabled)}
                  />
                  <Label className="text-sm font-medium">
                    Confirmation #{confirmation.sequence}
                  </Label>
                  {getRoleBadge(confirmation.assigned_role)}
                </div>
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(index)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Configuration Row */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Label */}
                <div className="space-y-2">
                  <Label htmlFor={`label-${index}`} className="text-xs text-muted-foreground">
                    Label
                  </Label>
                  <Input
                    id={`label-${index}`}
                    value={confirmation.label}
                    onChange={(e) => onUpdate(index, "label", e.target.value)}
                    placeholder="e.g., 24h Before"
                    disabled={!confirmation.enabled}
                  />
                </div>

                {/* Time Before */}
                <div className="space-y-2">
                  <Label htmlFor={`hours-${index}`} className="text-xs text-muted-foreground">
                    Hours Before
                  </Label>
                  <Input
                    id={`hours-${index}`}
                    type="number"
                    value={confirmation.hours_before}
                    onChange={(e) => onUpdate(index, "hours_before", parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.5}
                    disabled={!confirmation.enabled}
                  />
                </div>

                {/* Assigned Role */}
                <div className="space-y-2">
                  <Label htmlFor={`role-${index}`} className="text-xs text-muted-foreground">
                    Assigned To
                  </Label>
                  <Select
                    value={confirmation.assigned_role}
                    onValueChange={(value) => onUpdate(index, "assigned_role", value)}
                    disabled={!confirmation.enabled}
                  >
                    <SelectTrigger id={`role-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="setter">Setter</SelectItem>
                      <SelectItem value="closer">Closer</SelectItem>
                      <SelectItem value="off">Off (Skip)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview Text */}
              {confirmation.enabled && confirmation.assigned_role !== "off" && (
                <p className="text-xs text-muted-foreground">
                  {confirmation.assigned_role === "setter" ? "Setter" : "Closer"} will receive this task{" "}
                  {confirmation.hours_before >= 1
                    ? `${confirmation.hours_before} hours`
                    : `${Math.round(confirmation.hours_before * 60)} minutes`}{" "}
                  before the appointment
                </p>
              )}

              {!confirmation.enabled && (
                <p className="text-xs text-muted-foreground">
                  This confirmation step is disabled and will be skipped
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
