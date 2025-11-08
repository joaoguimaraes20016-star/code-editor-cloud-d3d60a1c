import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TaskRoutingSettingsProps {
  teamId: string;
}

export function TaskRoutingSettings({ teamId }: TaskRoutingSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [confirmationRoutingMode, setConfirmationRoutingMode] = useState<string>("setter_only");
  const [confirmationSetterCount, setConfirmationSetterCount] = useState<number>(2);
  const [mrrTaskAssignment, setMrrTaskAssignment] = useState<string>("closer_who_closed");
  const [confirmationSchedule, setConfirmationSchedule] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
  }, [teamId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("confirmation_routing_mode, confirmation_setter_count, mrr_task_assignment, confirmation_schedule")
        .eq("id", teamId)
        .single();

      if (error) throw error;

      if (data) {
        setConfirmationRoutingMode(data.confirmation_routing_mode || "setter_only");
        setConfirmationSetterCount(data.confirmation_setter_count || 2);
        setMrrTaskAssignment(data.mrr_task_assignment || "closer_who_closed");
        
        // Parse confirmation schedule safely
        try {
          const schedule = typeof data.confirmation_schedule === 'string' 
            ? JSON.parse(data.confirmation_schedule)
            : data.confirmation_schedule;
          setConfirmationSchedule(Array.isArray(schedule) ? schedule : []);
        } catch {
          setConfirmationSchedule([]);
        }
      }
    } catch (error: any) {
      console.error("Error loading task routing settings:", error);
      toast({
        title: "Error",
        description: "Failed to load task routing settings",
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
          confirmation_routing_mode: confirmationRoutingMode,
          confirmation_setter_count: confirmationSetterCount,
          mrr_task_assignment: mrrTaskAssignment,
        })
        .eq("id", teamId);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Task routing updated. New appointments will follow this workflow.",
      });
    } catch (error: any) {
      console.error("Error saving task routing settings:", error);
      toast({
        title: "Error",
        description: "Failed to save task routing settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderConfirmationFlow = () => {
    if (confirmationSchedule.length === 0) {
      return (
        <div className="text-sm text-muted-foreground">
          No confirmation schedule configured
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-lg border">
        {confirmationSchedule.map((conf: any, index: number) => {
          const sequence = index + 1;
          let assignedTo = "";
          
          if (confirmationRoutingMode === "setter_only") {
            assignedTo = "Setter";
          } else if (confirmationRoutingMode === "closer_only") {
            assignedTo = "Closer";
          } else if (confirmationRoutingMode === "sequential_setter_then_closer") {
            assignedTo = sequence <= confirmationSetterCount ? "Setter" : "Closer";
          }

          const badgeVariant = assignedTo === "Setter" ? "default" : "secondary";

          return (
            <div key={index} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <Badge variant={badgeVariant} className="mb-1">
                  {assignedTo}
                </Badge>
                <div className="text-xs text-muted-foreground text-center">
                  {conf.label || `${conf.hours_before}h before`}
                </div>
              </div>
              {index < confirmationSchedule.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Confirmation Task Routing</CardTitle>
          <CardDescription>
            Configure who handles call confirmations for appointments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={confirmationRoutingMode}
            onValueChange={setConfirmationRoutingMode}
          >
            <div className="flex items-start space-x-3 space-y-0">
              <RadioGroupItem value="setter_only" id="setter_only" />
              <div className="space-y-1 flex-1">
                <Label htmlFor="setter_only" className="cursor-pointer">
                  Setters Only
                </Label>
                <p className="text-sm text-muted-foreground">
                  All confirmation tasks assigned to setters
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0">
              <RadioGroupItem value="closer_only" id="closer_only" />
              <div className="space-y-1 flex-1">
                <Label htmlFor="closer_only" className="cursor-pointer">
                  Closers Only
                </Label>
                <p className="text-sm text-muted-foreground">
                  All confirmation tasks assigned to closers
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0">
              <RadioGroupItem
                value="sequential_setter_then_closer"
                id="sequential_setter_then_closer"
              />
              <div className="space-y-1 flex-1">
                <Label htmlFor="sequential_setter_then_closer" className="cursor-pointer">
                  Sequential (Setter → Closer)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Setter handles initial confirmations, closer handles final ones
                </p>
                {confirmationRoutingMode === "sequential_setter_then_closer" && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="setter_count" className="text-sm">
                      Setter confirms first:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="setter_count"
                        type="number"
                        min={0}
                        max={10}
                        value={confirmationSetterCount}
                        onChange={(e) =>
                          setConfirmationSetterCount(parseInt(e.target.value) || 0)
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        confirmation(s), then closer handles the rest
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Confirmation Flow Preview</Label>
            {renderConfirmationFlow()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MRR Follow-up Task Assignment</CardTitle>
          <CardDescription>
            Choose who receives monthly MRR follow-up tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={mrrTaskAssignment} onValueChange={setMrrTaskAssignment}>
            <div className="flex items-start space-x-3 space-y-0">
              <RadioGroupItem value="closer_who_closed" id="closer_who_closed" />
              <div className="space-y-1 flex-1">
                <Label htmlFor="closer_who_closed" className="cursor-pointer">
                  Closer Who Closed the Deal
                </Label>
                <p className="text-sm text-muted-foreground">
                  The closer who finalized the deal handles MRR renewals (recommended)
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0">
              <RadioGroupItem value="original_setter" id="original_setter" />
              <div className="space-y-1 flex-1">
                <Label htmlFor="original_setter" className="cursor-pointer">
                  Original Appointment Setter
                </Label>
                <p className="text-sm text-muted-foreground">
                  The setter who booked the appointment handles MRR renewals
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0">
              <RadioGroupItem value="appointment_closer" id="appointment_closer" />
              <div className="space-y-1 flex-1">
                <Label htmlFor="appointment_closer" className="cursor-pointer">
                  Assigned Closer on Appointment
                </Label>
                <p className="text-sm text-muted-foreground">
                  The closer assigned to the appointment (may differ from who closed it)
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Task Routing Settings
        </Button>
      </div>
    </div>
  );
}
