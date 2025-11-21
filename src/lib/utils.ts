import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date/time with timezone indicator (e.g., "Dec 15, 2024 at 2:30 pm EST")
 */
export function formatDateTimeWithTimezone(
  date: string | Date,
  formatPattern: string = "MMM d, yyyy 'at' h:mm a"
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formattedDate = format(dateObj, formatPattern);
  
  // Get timezone abbreviation using Intl API
  const timezone = new Intl.DateTimeFormat('en-US', { 
    timeZoneName: 'short' 
  }).formatToParts(dateObj).find(part => part.type === 'timeZoneName')?.value || '';
  
  return `${formattedDate} ${timezone}`.trim();
}
