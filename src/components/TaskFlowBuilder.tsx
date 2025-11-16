import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, Plus, Trash2, Clock, User, UserCheck, XCircle, Shield, Crown, Info } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ConfirmationConfig {
  sequence: number;
  hours_before: number;
  label: string;
  assigned_role: "setter" | "closer" | "admin" | "offer_owner" | "off";
  assignment_mode?: "round_robin" | "individual";
  assigned_user_id?: string | null;
  enabled: boolean;
}

interface TeamMember {
  user_id: string;
  role: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  };
}

interface DefaultTaskRouting {
  follow_up: "setter" | "closer" | "admin" | "offer_owner";
  reschedule: "setter" | "closer" | "admin" | "offer_owner";
  manual_task: "setter" | "closer" | "admin" | "offer_owner";
}

interface TaskFlowBuilderProps {
  teamId: string;
}

const formatHoursLabel = (hours: number): string => {
  // Less than 1 hour - show minutes
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  
  // Less than 24 hours - show hours
  if (hours < 24) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  
  // 24 hours or more - show days
  const days = hours / 24;
  if (days === Math.floor(days)) {
    return days === 1 ? "1 day" : `${days} days`;
  }
  
  // Mixed (like 36 hours = 1.5 days) - just show hours
  return `${hours} hours`;
};

function ConfirmationCard({
  confirmation, 
  index, 
  onUpdate, 
  onDelete, 
  canDelete,
  teamMembers,
}: { 
  confirmation: ConfirmationConfig; 
  index: number; 
  onUpdate: (index: number, field: keyof ConfirmationConfig, value: any) => void;
  onDelete: (index: number) => void;
  canDelete: boolean;
  teamMembers: TeamMember[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: confirmation.sequence.toString() 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getRoleBadge = (role: string) => {
    if (role === "setter") return <Badge variant="default"><User className="w-3 h-3 mr-1" />Setter</Badge>;
    if (role === "closer") return <Badge variant="default"><UserCheck className="w-3 h-3 mr-1" />Closer</Badge>;
    if (role === "admin") return <Badge variant="default"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
    if (role === "offer_owner") return <Badge variant="default"><Crown className="w-3 h-3 mr-1" />Offer Owner</Badge>;
    return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Off</Badge>;
  };

  const getAssignmentModeLabel = (mode?: string) => {
    if (mode === "individual") return "Individual";
    return "Round-robin";
  };

  const filteredMembers = teamMembers.filter(m => m.role === confirmation.assigned_role);

  return (
    <div ref={setNodeRef} style={style} className="group">
      <Card className={`border-l-4 transition-all ${
        confirmation.enabled 
          ? confirmation.assigned_role === "setter" 
            ? "border-l-primary" 
            : confirmation.assigned_role === "closer"
            ? "border-l-info"
            : "border-l-muted"
          : "border-l-muted opacity-60"
      }`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </div>

            {/* Enable Toggle */}
            <Switch
              checked={confirmation.enabled}
              onCheckedChange={(checked) => onUpdate(index, "enabled", checked)}
            />

            {/* Time Input */}
            <div className="flex items-center gap-2 flex-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                value={confirmation.hours_before}
                onChange={(e) => onUpdate(index, "hours_before", parseFloat(e.target.value))}
                className="w-20"
                min="0"
                step="0.1"
                disabled={!confirmation.enabled}
              />
              <span className="text-sm text-muted-foreground">hours before</span>
            </div>

            {/* Label Input */}
            <Input
              value={confirmation.label}
              onChange={(e) => onUpdate(index, "label", e.target.value)}
              placeholder="Label"
              className="w-32"
              disabled={!confirmation.enabled}
            />

            {/* Role Select */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select
                      value={confirmation.assigned_role}
                      onValueChange={(value) => onUpdate(index, "assigned_role", value)}
                      disabled={!confirmation.enabled}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="setter">Setter</SelectItem>
                        <SelectItem value="closer">Closer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="offer_owner">Offer Owner</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Select which role should receive this confirmation task.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Role Badge */}
            {getRoleBadge(confirmation.assigned_role)}

            {/* Delete Button */}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(index)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>

          {/* Assignment Mode - Only show if role is not "off" */}
          {confirmation.enabled && confirmation.assigned_role !== "off" && (
            <div className="pl-11 space-y-3 pt-2 border-t">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium">Assignment:</Label>
                <Select
                  value={confirmation.assignment_mode || "round_robin"}
                  onValueChange={(value) => onUpdate(index, "assignment_mode", value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round-robin rotation</SelectItem>
                    <SelectItem value="individual">Specific person</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="secondary">{getAssignmentModeLabel(confirmation.assignment_mode)}</Badge>
              </div>

              {/* Individual User Selection */}
              {confirmation.assignment_mode === "individual" && (
                <div className="flex items-center gap-4 pl-24">
                  <Label className="text-sm">Person:</Label>
                  <Select
                    value={confirmation.assigned_user_id || ""}
                    onValueChange={(value) => onUpdate(index, "assigned_user_id", value)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder={`Select ${confirmation.assigned_role}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredMembers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No {confirmation.assigned_role}s found
                        </div>
                      ) : (
                        filteredMembers.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.profiles.full_name || member.profiles.email || "Unknown"}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function TaskFlowBuilder({ teamId }: TaskFlowBuilderProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmations, setConfirmations] = useState<ConfirmationConfig[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [defaultRouting, setDefaultRouting] = useState<DefaultTaskRouting>({
    follow_up: "setter",
    reschedule: "setter",
    manual_task: "closer",
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadSettings();
    loadTeamMembers();
  }, [teamId]);

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          user_id,
          role,
          profiles (
            full_name,
            email
          )
        `)
        .eq("team_id", teamId)
        .eq("is_active", true);

      if (error) throw error;
      if (data) {
        setTeamMembers(data as unknown as TeamMember[]);
      }
    } catch (error) {
      console.error("Error loading team members:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("confirmation_flow_config, default_task_routing")
        .eq("id", teamId)
        .single();

      if (error) throw error;

      if (data.confirmation_flow_config) {
        setConfirmations(data.confirmation_flow_config as unknown as ConfirmationConfig[]);
      }
      if (data.default_task_routing) {
        setDefaultRouting(data.default_task_routing as unknown as DefaultTaskRouting);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "Failed to load task flow settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({
          confirmation_flow_config: confirmations as any,
          default_task_routing: defaultRouting as any,
        })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task flow settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save task flow settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfirmation = (index: number, field: keyof ConfirmationConfig, value: any) => {
    const updated = [...confirmations];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-update label when hours_before changes
    if (field === "hours_before") {
      updated[index].label = formatHoursLabel(value);
    }
    
    setConfirmations(updated);
  };

  const addConfirmation = () => {
    const newSequence = Math.max(...confirmations.map(c => c.sequence), 0) + 1;
    setConfirmations([
      ...confirmations,
      {
        sequence: newSequence,
        hours_before: 12,
        label: formatHoursLabel(12),
        assigned_role: "setter",
        assignment_mode: "round_robin",
        assigned_user_id: null,
        enabled: true,
      },
    ]);
  };

  const deleteConfirmation = (index: number) => {
    const updated = confirmations.filter((_, i) => i !== index);
    // Resequence
    updated.forEach((conf, i) => {
      conf.sequence = i + 1;
    });
    setConfirmations(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = confirmations.findIndex(c => c.sequence.toString() === active.id);
    const newIndex = confirmations.findIndex(c => c.sequence.toString() === over.id);

    const reordered = arrayMove(confirmations, oldIndex, newIndex);
    // Resequence
    reordered.forEach((conf, i) => {
      conf.sequence = i + 1;
    });
    setConfirmations(reordered);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabledCount = confirmations.filter(c => c.enabled).length;

  return (
    <div className="space-y-6">
      {/* Visual Timeline Preview */}
      <Card className="bg-gradient-to-r from-primary/5 to-info/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Confirmation Flow Timeline
          </CardTitle>
          <CardDescription>
            Visual preview of your confirmation workflow from booking to appointment time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative py-8">
            {/* Timeline Line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-border -translate-y-1/2"></div>
            
            {/* Timeline Nodes */}
            <div className="relative flex justify-between items-center">
              {/* Booking Node */}
              <div className="flex flex-col items-center z-10">
                <div className="w-4 h-4 rounded-full bg-success mb-2"></div>
                <span className="text-xs font-medium">Booked</span>
              </div>

              {/* Confirmation Nodes */}
              {confirmations
                .filter(c => c.enabled)
                .sort((a, b) => b.hours_before - a.hours_before)
                .map((conf) => (
                  <div key={conf.sequence} className="flex flex-col items-center z-10">
                <div className={`w-4 h-4 rounded-full mb-2 ${
                  conf.assigned_role === "setter" 
                    ? "bg-primary" 
                    : conf.assigned_role === "closer"
                    ? "bg-primary"
                    : conf.assigned_role === "admin"
                    ? "bg-primary"
                    : conf.assigned_role === "offer_owner"
                    ? "bg-primary"
                    : "bg-muted"
                }`}></div>
                    <span className="text-xs font-medium">{conf.label}</span>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {conf.assigned_role === "setter" 
                        ? "Setter" 
                        : conf.assigned_role === "closer"
                        ? "Closer"
                        : conf.assigned_role === "admin"
                        ? "Admin"
                        : conf.assigned_role === "offer_owner"
                        ? "Offer Owner"
                        : "Off"}
                    </Badge>
                  </div>
                ))}

              {/* Appointment Node */}
              <div className="flex flex-col items-center z-10">
                <div className="w-4 h-4 rounded-full bg-chart-2 mb-2"></div>
                <span className="text-xs font-medium">Appointment</span>
              </div>
            </div>
          </div>

          {enabledCount === 0 && (
            <div className="text-center text-sm text-destructive mt-4">
              ⚠️ Warning: No confirmations are enabled. Enable at least one confirmation below.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Confirmation Tasks</CardTitle>
          <CardDescription>
            Configure when confirmations happen and who handles them. Drag to reorder.
          </CardDescription>
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Tasks are automatically assigned using round-robin distribution to team members with the fewest pending tasks. Setters and Closers must be in rotation, while Admin and Offer Owner roles are always included.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={confirmations.map(c => c.sequence.toString())} strategy={verticalListSortingStrategy}>
              {confirmations.map((conf, index) => (
                <ConfirmationCard
                  key={conf.sequence}
                  confirmation={conf}
                  index={index}
                  onUpdate={updateConfirmation}
                  onDelete={deleteConfirmation}
                  canDelete={confirmations.length > 1}
                  teamMembers={teamMembers}
                />
              ))}
            </SortableContext>
          </DndContext>

          <Button onClick={addConfirmation} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Confirmation Point
          </Button>
        </CardContent>
      </Card>

      {/* Default Task Routing */}
      <Card>
        <CardHeader>
          <CardTitle>Default Task Assignment</CardTitle>
          <CardDescription>
            Set default role assignments for other task types
          </CardDescription>
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              These settings determine which role receives follow-up, reschedule, and manually created tasks by default.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Follow-up Tasks</Label>
              <p className="text-sm text-muted-foreground">Who handles follow-up tasks by default</p>
            </div>
            <Select
              value={defaultRouting.follow_up}
              onValueChange={(value: "setter" | "closer") => 
                setDefaultRouting({ ...defaultRouting, follow_up: value })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="setter">Setter</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="offer_owner">Offer Owner</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Reschedule Tasks</Label>
              <p className="text-sm text-muted-foreground">Who handles reschedule requests</p>
            </div>
            <Select
              value={defaultRouting.reschedule}
              onValueChange={(value: "setter" | "closer") => 
                setDefaultRouting({ ...defaultRouting, reschedule: value })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="setter">Setter</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="offer_owner">Offer Owner</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Manual Tasks</Label>
              <p className="text-sm text-muted-foreground">Who handles manually created tasks</p>
            </div>
            <Select
              value={defaultRouting.manual_task}
              onValueChange={(value: "setter" | "closer") => 
                setDefaultRouting({ ...defaultRouting, manual_task: value })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="setter">Setter</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="offer_owner">Offer Owner</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving || enabledCount === 0} className="w-full">
        {saving ? "Saving..." : "Save Task Flow Settings"}
      </Button>
    </div>
  );
}
