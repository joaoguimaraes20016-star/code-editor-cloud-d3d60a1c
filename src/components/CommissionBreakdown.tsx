import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sale } from "./SalesTable";
import { User } from "lucide-react";

interface CommissionBreakdownProps {
  sales: Sale[];
}

export function CommissionBreakdown({ sales }: CommissionBreakdownProps) {
  // Calculate commission totals by sales rep
  const repCommissions = sales
    .filter(s => s.status === 'closed')
    .reduce((acc, sale) => {
      if (!acc[sale.salesRep]) {
        acc[sale.salesRep] = {
          totalCommission: 0,
          totalRevenue: 0,
          salesCount: 0,
        };
      }
      acc[sale.salesRep].totalCommission += sale.commission;
      acc[sale.salesRep].totalRevenue += sale.revenue;
      acc[sale.salesRep].salesCount += 1;
      return acc;
    }, {} as Record<string, { totalCommission: number; totalRevenue: number; salesCount: number }>);

  const sortedReps = Object.entries(repCommissions).sort(
    ([, a], [, b]) => b.totalCommission - a.totalCommission
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission Breakdown by Sales Rep</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedReps.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No commission data available yet
            </p>
          ) : (
            sortedReps.map(([rep, data]) => (
              <div 
                key={rep} 
                className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{rep}</p>
                    <p className="text-sm text-muted-foreground">
                      {data.salesCount} {data.salesCount === 1 ? 'sale' : 'sales'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-accent">
                    ${data.totalCommission.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ${data.totalRevenue.toLocaleString()} revenue
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
