import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UndoAction {
  table: string;
  recordId: string;
  previousData: Record<string, any>;
  description: string;
}

export function useUndoAction() {
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);

  const trackAction = useCallback((action: UndoAction) => {
    setLastAction(action);
  }, []);

  const performUndo = useCallback(async () => {
    if (!lastAction) return;

    try {
      const { error } = await supabase
        .from(lastAction.table as any)
        .update(lastAction.previousData)
        .eq('id', lastAction.recordId);

      if (error) throw error;

      toast.success("Action undone successfully");
      setLastAction(null);
    } catch (error) {
      console.error("Error undoing action:", error);
      toast.error("Failed to undo action");
    }
  }, [lastAction]);

  const showUndoToast = useCallback((description: string) => {
    toast.success(description, {
      action: {
        label: "Undo",
        onClick: performUndo,
      },
      duration: 10000, // 10 seconds to undo
    } as any);
  }, [performUndo]);

  return {
    trackAction,
    performUndo,
    showUndoToast,
    hasUndo: !!lastAction,
  };
}
