import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface DealAvatarProps {
  name: string;
  className?: string;
}

export function DealAvatar({ name, className }: DealAvatarProps) {
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getColorFromName = (name: string) => {
    const colors = [
      'bg-chart-1',
      'bg-chart-2',
      'bg-chart-3',
      'bg-chart-4',
      'bg-success',
      'bg-info',
      'bg-primary',
      'bg-destructive',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <Avatar className={`${className} ring-2 ring-border shadow-lg`}>
      <AvatarFallback className={`${getColorFromName(name)} text-primary-foreground text-xs font-bold`}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
