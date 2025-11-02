import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface AppointmentFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  eventTypeFilter: string;
  onEventTypeFilterChange: (value: string) => void;
  eventTypes: string[];
  onClearFilters: () => void;
}

export function AppointmentFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  eventTypeFilter,
  onEventTypeFilterChange,
  eventTypes,
  onClearFilters,
}: AppointmentFiltersProps) {
  const hasActiveFilters = searchQuery || statusFilter !== "all" || eventTypeFilter !== "all";

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by lead name or email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="NEW">Pending Confirmation</SelectItem>
          <SelectItem value="CONFIRMED">Confirmed</SelectItem>
          <SelectItem value="SHOWED">Showed</SelectItem>
          <SelectItem value="NO_SHOW">No Show</SelectItem>
          <SelectItem value="CLOSED">Closed</SelectItem>
          <SelectItem value="CANCELLED">Cancelled</SelectItem>
          <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
        </SelectContent>
      </Select>

      {eventTypes.length > 0 && (
        <Select value={eventTypeFilter} onValueChange={onEventTypeFilterChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Event Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Event Types</SelectItem>
            {eventTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="icon" onClick={onClearFilters}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
