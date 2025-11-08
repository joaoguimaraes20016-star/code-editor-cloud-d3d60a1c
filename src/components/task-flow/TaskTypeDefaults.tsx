import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { UserCheck, UserCircle, Calendar, RefreshCw } from "lucide-react";

interface DefaultTaskRouting {
  follow_up: "setter" | "closer";
  reschedule: "setter" | "closer";
  manual_task: "setter" | "closer";
}

interface TaskTypeDefaultsProps {
  defaultRouting: DefaultTaskRouting;
  onChange: (routing: DefaultTaskRouting) => void;
}

export function TaskTypeDefaults({ defaultRouting, onChange }: TaskTypeDefaultsProps) {
  const updateRouting = (taskType: keyof DefaultTaskRouting, role: "setter" | "closer") => {
    onChange({
      ...defaultRouting,
      [taskType]: role,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Task Assignment</CardTitle>
        <CardDescription>
          Configure which role handles follow-up and reschedule tasks by default
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Follow-up Tasks */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Follow-up Tasks</Label>
            <Badge variant="outline" className="ml-auto text-xs">
              {defaultRouting.follow_up === "setter" ? "Setter" : "Closer"}
            </Badge>
          </div>
          <RadioGroup
            value={defaultRouting.follow_up}
            onValueChange={(value) => updateRouting("follow_up", value as "setter" | "closer")}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor="follow-up-setter"
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                defaultRouting.follow_up === "setter"
                  ? "border-success bg-success/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value="setter" id="follow-up-setter" />
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Setter</span>
              </div>
            </Label>
            <Label
              htmlFor="follow-up-closer"
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                defaultRouting.follow_up === "closer"
                  ? "border-info bg-info/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value="closer" id="follow-up-closer" />
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-info" />
                <span className="text-sm font-medium">Closer</span>
              </div>
            </Label>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            When a lead needs follow-up, assign the task to this role
          </p>
        </div>

        {/* Reschedule Tasks */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Reschedule Tasks</Label>
            <Badge variant="outline" className="ml-auto text-xs">
              {defaultRouting.reschedule === "setter" ? "Setter" : "Closer"}
            </Badge>
          </div>
          <RadioGroup
            value={defaultRouting.reschedule}
            onValueChange={(value) => updateRouting("reschedule", value as "setter" | "closer")}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor="reschedule-setter"
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                defaultRouting.reschedule === "setter"
                  ? "border-success bg-success/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value="setter" id="reschedule-setter" />
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Setter</span>
              </div>
            </Label>
            <Label
              htmlFor="reschedule-closer"
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                defaultRouting.reschedule === "closer"
                  ? "border-info bg-info/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value="closer" id="reschedule-closer" />
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-info" />
                <span className="text-sm font-medium">Closer</span>
              </div>
            </Label>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            When an appointment needs to be rescheduled, assign the task to this role
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
