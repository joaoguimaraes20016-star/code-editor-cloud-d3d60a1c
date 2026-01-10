import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  // Check if this is a builder textarea by class name
  const isBuilderInput = className?.includes('builder-input');
  
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        isBuilderInput 
          ? "bg-[hsl(220,20%,11%)] border-[hsl(220,18%,14%)] text-white placeholder:text-[hsl(220,10%,35%)]"
          : "bg-background border-input placeholder:text-muted-foreground",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
