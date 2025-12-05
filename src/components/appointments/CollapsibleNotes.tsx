import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleNotesProps {
  title: string;
  notes: string | null;
  variant?: "setter" | "closer";
  defaultOpen?: boolean;
}

export function CollapsibleNotes({ title, notes, variant = "setter", defaultOpen = false }: CollapsibleNotesProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!notes) return null;

  const colors = variant === "setter" 
    ? "bg-chart-2/10 border-chart-2/30 text-chart-2"
    : "bg-primary/10 border-primary/30 text-primary";

  const iconColor = variant === "setter" ? "text-chart-2" : "text-primary";

  return (
    <div className={cn("rounded-md border overflow-hidden", colors)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-2 sm:p-3 text-left hover:bg-black/5 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className={cn("h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0", iconColor)} />
        ) : (
          <ChevronRight className={cn("h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0", iconColor)} />
        )}
        {variant === "setter" ? (
          <MessageSquare className={cn("h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0", iconColor)} />
        ) : (
          <StickyNote className={cn("h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0", iconColor)} />
        )}
        <span className="text-xs sm:text-sm font-medium text-foreground">{title}</span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
          <p className="text-xs sm:text-sm text-foreground whitespace-pre-line pl-5 sm:pl-6">
            {notes}
          </p>
        </div>
      )}
    </div>
  );
}
