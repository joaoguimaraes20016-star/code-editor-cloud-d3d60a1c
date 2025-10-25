import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeaderboardEntry {
  name: string;
  sales: number;
  revenue: number;
  commission: number;
}

interface LeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
  type: 'closer' | 'setter';
}

export function Leaderboard({ title, entries, type }: LeaderboardProps) {
  const getMedalIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-primary" />;
    if (index === 1) return <Award className="h-5 w-5 text-chart-2" />;
    if (index === 2) return <Award className="h-5 w-5 text-chart-3" />;
    return <span className="text-muted-foreground font-semibold">#{index + 1}</span>;
  };

  return (
    <Card className="card-hover">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No {type}s yet. Start adding sales to see the leaderboard!
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div
                key={entry.name}
                className="group relative overflow-hidden flex items-center justify-between p-4 rounded-lg bg-gradient-to-br from-card to-secondary/30 border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow"
              >
                <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/50 group-hover:bg-primary/20 transition-colors">
                    {getMedalIcon(index)}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{entry.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.sales} {entry.sales === 1 ? 'sale' : 'sales'}
                    </p>
                  </div>
                </div>
                <div className="relative z-10 text-right">
                  <p className="font-bold text-lg text-primary">
                    ${entry.commission.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ${entry.revenue.toLocaleString()} revenue
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
