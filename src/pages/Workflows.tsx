import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, GitBranch, Workflow, Bot } from "lucide-react";
import { TaskFlowBuilder } from "@/components/TaskFlowBuilder";
import { FollowUpSettings } from "@/components/FollowUpSettings";
import { ActionPipelineMappings } from "@/components/ActionPipelineMappings";
import { AutomationsList } from "@/components/automations/AutomationsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Workflows() {
  const { teamId } = useParams();

  if (!teamId) {
    return <div className="p-8 text-center text-muted-foreground">Team not found</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Workflow className="h-6 w-6 text-primary" />
          Workflows & Automations
        </h1>
        <p className="text-muted-foreground">Configure automated task flows, follow-ups, and pipeline actions</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="automations" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="automations" className="gap-2">
            <Bot className="h-4 w-4" />
            Automations
          </TabsTrigger>
          <TabsTrigger value="confirmations" className="gap-2">
            <Zap className="h-4 w-4" />
            Call Confirmations
          </TabsTrigger>
          <TabsTrigger value="followups" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Follow-Up Flows
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2">
            <Workflow className="h-4 w-4" />
            Pipeline Actions
          </TabsTrigger>
        </TabsList>

        {/* Automations Tab */}
        <TabsContent value="automations" className="space-y-4">
          <AutomationsList teamId={teamId} />
        </TabsContent>

        {/* Call Confirmation Flow */}
        <TabsContent value="confirmations" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Call Confirmation Flow</CardTitle>
              <CardDescription>
                Configure when and how confirmation tasks are created for new appointments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TaskFlowBuilder teamId={teamId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Follow-Up Flows */}
        <TabsContent value="followups" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Automated Follow-Up Flows</CardTitle>
              <CardDescription>Set up automatic follow-up tasks based on pipeline stage changes</CardDescription>
            </CardHeader>
            <CardContent>
              <FollowUpSettings teamId={teamId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipeline Action Mappings */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Action → Pipeline Mappings</CardTitle>
              <CardDescription>Define which pipeline stage leads move to when specific actions occur</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionPipelineMappings teamId={teamId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
