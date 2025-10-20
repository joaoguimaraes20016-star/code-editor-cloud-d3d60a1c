import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sale } from "./SalesTable";
import { User, UserCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CommissionBreakdownProps {
  sales: Sale[];
}

export function CommissionBreakdown({ sales }: CommissionBreakdownProps) {
  // Calculate closer commission totals (exclude zero commissions)
  const closerCommissions = sales
    .filter(s => s.status === 'closed' && s.commission > 0)
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

  // Calculate setter commission totals (exclude zero commissions)
  const setterCommissions = sales
    .filter(s => s.status === 'closed' && s.setterCommission > 0)
    .reduce((acc, sale) => {
      if (!acc[sale.setter]) {
        acc[sale.setter] = {
          totalCommission: 0,
          totalRevenue: 0,
          salesCount: 0,
        };
      }
      acc[sale.setter].totalCommission += sale.setterCommission;
      acc[sale.setter].totalRevenue += sale.revenue;
      acc[sale.setter].salesCount += 1;
      return acc;
    }, {} as Record<string, { totalCommission: number; totalRevenue: number; salesCount: number }>);

  const sortedClosers = Object.entries(closerCommissions).sort(
    ([, a], [, b]) => b.totalCommission - a.totalCommission
  );

  const sortedSetters = Object.entries(setterCommissions).sort(
    ([, a], [, b]) => b.totalCommission - a.totalCommission
  );

  const renderCommissionList = (
    data: [string, { totalCommission: number; totalRevenue: number; salesCount: number }][],
    icon: typeof User,
    emptyMessage: string
  ) => {
    const Icon = icon;
    
    if (data.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-8">
          {emptyMessage}
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {data.map(([name, stats]) => (
          <div 
            key={name} 
            className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-sm text-muted-foreground">
                  {stats.salesCount} {stats.salesCount === 1 ? 'sale' : 'sales'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-accent">
                ${stats.totalCommission.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                ${stats.totalRevenue.toLocaleString()} revenue
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="closers" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="closers">Closers</TabsTrigger>
            <TabsTrigger value="setters">Setters</TabsTrigger>
          </TabsList>
          <TabsContent value="closers" className="mt-4">
            {renderCommissionList(
              sortedClosers,
              UserCheck,
              "No closer commission data available yet"
            )}
          </TabsContent>
          <TabsContent value="setters" className="mt-4">
            {renderCommissionList(
              sortedSetters,
              User,
              "No setter commission data available yet"
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
