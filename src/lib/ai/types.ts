// src/lib/ai/types.ts

export type AiTaskType =
  | 'suggest_workflow'
  | 'explain_workflow'
  | 'rewrite_message_template';

export interface AiWorkflowSuggestionRequest {
  task: 'suggest_workflow';
  teamId: string;
  niche: string; // e.g. "fitness coaching", "real estate", etc.
  goal: string;  // e.g. "book more qualified calls"
  currentStack?: string[];
}

export interface AiWorkflowSuggestionResponse {
  title: string;
  description: string;
  suggestedTriggers: string[];
  suggestedSteps: Array<{
    label: string;
    actionType: string;
    explanation: string;
  }>;
}

export interface AiExplainWorkflowRequest {
  task: 'explain_workflow';
  workflowJson: any;
}

export interface AiExplainWorkflowResponse {
  summary: string;
  pros: string[];
  risks: string[];
  suggestions: string[];
}

export interface AiRewriteTemplateRequest {
  task: 'rewrite_message_template';
  channel: 'sms' | 'email';
  tone: 'casual' | 'professional' | 'aggressive' | 'soft';
  currentTemplate: string;
  targetAvatarDescription: string;
}

export interface AiRewriteTemplateResponse {
  improvedTemplate: string;
  rationale: string;
}
