// src/lib/workflows/serializer.ts
import type { WorkflowDefinition, WorkflowNode } from './types';
import type {
  AutomationDefinition,
  AutomationStep,
  AutomationCondition,
} from '../automations/types';

/**
 * Finds the first trigger node in a workflow.
 * Right now we assume a single trigger per workflow.
 */
function findTriggerNode(nodes: WorkflowNode[]): WorkflowNode | undefined {
  return nodes.find((n) => n.kind === 'trigger');
}

/**
 * Naive transformer that maps a WorkflowDefinition into
 * a single AutomationDefinition the engine can execute.
 *
 * Later you can make this more advanced (branching, multiple steps, etc.)
 */
export function workflowToAutomation(
  workflow: WorkflowDefinition,
): AutomationDefinition | null {
  const triggerNode = findTriggerNode(workflow.nodes);
  if (!triggerNode || triggerNode.kind !== 'trigger') return null;

  const baseAutomation: AutomationDefinition = {
    id: workflow.id,
    teamId: workflow.teamId,
    name: workflow.name,
    description: workflow.description ?? '',
    isActive: workflow.isActive,
    trigger: {
      type: triggerNode.triggerType,
      config: triggerNode.config ?? {},
    },
    steps: [],
  };

  // For now we simply turn every action node into a linear AutomationStep.
  const actionNodes = workflow.nodes.filter((n) => n.kind === 'action');

  const steps: AutomationStep[] = actionNodes.map((node, index) => {
    const actionConfig = (node as any).config ?? {};

    const stepConditions: AutomationCondition[] | undefined =
      (actionConfig.conditions as AutomationCondition[]) ?? undefined;

    return {
      id: `${workflow.id}_step_${index}`,
      order: index,
      type: node.actionType,
      config: actionConfig,
      conditions: stepConditions,
    };
  });

  return {
    ...baseAutomation,
    steps,
  };
}
