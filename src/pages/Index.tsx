import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { SalesTable, Sale } from "@/components/SalesTable";
import { AddSaleDialog } from "@/components/AddSaleDialog";
import { RevenueChart } from "@/components/RevenueChart";
import { CommissionBreakdown } from "@/components/CommissionBreakdown";
import { ImportSpreadsheet } from "@/components/ImportSpreadsheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";

// Sample data
const initialSales: Sale[] = [
  {
    id: '1',
    customerName: 'Acme Corp',
    setter: 'Sarah Lee',
    salesRep: 'John Doe',
    date: '2025-10-10',
    revenue: 15000,
    setterCommission: 300,
    commission: 1500,
    status: 'closed',
  },
  {
    id: '2',
    customerName: 'TechStart Inc',
    setter: 'Mike Ross',
    salesRep: 'Jane Smith',
    date: '2025-10-12',
    revenue: 8500,
    setterCommission: 170,
    commission: 850,
    status: 'closed',
  },
  {
    id: '3',
    customerName: 'GlobalSoft',
    setter: 'Sarah Lee',
    salesRep: 'Mike Johnson',
    date: '2025-10-14',
    revenue: 12000,
    setterCommission: 240,
    commission: 1200,
    status: 'pending',
  },
  {
    id: '4',
    customerName: 'DataFlow Ltd',
    setter: 'Mike Ross',
    salesRep: 'Jane Smith',
    date: '2025-10-13',
    revenue: 0,
    setterCommission: 0,
    commission: 0,
    status: 'no-show',
  },
  {
    id: '5',
    customerName: 'CloudNine Systems',
    setter: 'Tom Brady',
    salesRep: 'John Doe',
    date: '2025-10-11',
    revenue: 22000,
    setterCommission: 440,
    commission: 2200,
    status: 'closed',
  },
];

const chartData = [
  { name: 'Mon', revenue: 4000 },
  { name: 'Tue', revenue: 3000 },
  { name: 'Wed', revenue: 5000 },
  { name: 'Thu', revenue: 8500 },
  { name: 'Fri', revenue: 6000 },
  { name: 'Sat', revenue: 7500 },
  { name: 'Sun', revenue: 4500 },
];

const Index = () => {
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [selectedRep, setSelectedRep] = useState<string>("all");

  const handleAddSale = (newSale: Omit<Sale, 'id'>) => {
    const sale: Sale = {
      ...newSale,
      id: Date.now().toString(),
    };
    setSales([sale, ...sales]);
  };

  const handleImport = (importedSales: Omit<Sale, 'id'>[]) => {
    const newSales = importedSales.map((sale, index) => ({
      ...sale,
      id: `${Date.now()}-${index}`,
    }));
    setSales([...newSales, ...sales]);
  };

  // Get unique sales reps
  const salesReps = ['all', ...new Set(sales.map(s => s.salesRep))];

  // Filter sales by selected rep
  const filteredSales = selectedRep === 'all' 
    ? sales 
    : sales.filter(s => s.salesRep === selectedRep);

  // Calculate metrics (use filtered sales for display)
  const totalRevenue = filteredSales
    .filter(s => s.status === 'closed')
    .reduce((sum, sale) => sum + sale.revenue, 0);
  
  const totalCommissions = filteredSales
    .filter(s => s.status === 'closed')
    .reduce((sum, sale) => sum + sale.commission + sale.setterCommission, 0);
  
  const closeRate = filteredSales.length > 0 
    ? ((filteredSales.filter(s => s.status === 'closed').length / filteredSales.length) * 100).toFixed(1)
    : '0';
  
  const showUpRate = filteredSales.length > 0
    ? ((filteredSales.filter(s => s.status !== 'no-show').length / filteredSales.length) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales Tracker</h1>
            <p className="text-muted-foreground mt-1">
              Track your sales performance and commissions
            </p>
          </div>
          <div className="flex gap-2">
            <ImportSpreadsheet onImport={handleImport} />
            <AddSaleDialog onAddSale={handleAddSale} />
          </div>
        </div>

        {/* Filter by Sales Rep */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Filter by Sales Rep:</label>
          <Select value={selectedRep} onValueChange={setSelectedRep}>
            <SelectTrigger className="w-[200px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card">
              {salesReps.map((rep) => (
                <SelectItem key={rep} value={rep}>
                  {rep === 'all' ? 'All Sales Reps' : rep}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            trend="+12.5% from last month"
            trendUp
          />
          <MetricCard
            title="Total Commissions"
            value={`$${totalCommissions.toLocaleString()}`}
            icon={TrendingUp}
            trend="+8.2% from last month"
            trendUp
          />
          <MetricCard
            title="Close Rate"
            value={`${closeRate}%`}
            icon={Users}
            trend="+4.3% from last month"
            trendUp
          />
          <MetricCard
            title="Show Up Rate"
            value={`${showUpRate}%`}
            icon={Calendar}
            trend="-2.1% from last month"
            trendUp={false}
          />
        </div>

        {/* Commission Breakdown */}
        <CommissionBreakdown sales={sales} />

        {/* Chart */}
        <RevenueChart data={chartData} />

        {/* Sales Table */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">
            {selectedRep === 'all' ? 'All Sales' : `${selectedRep}'s Sales`}
          </h2>
          <SalesTable sales={filteredSales} />
        </div>
      </div>
    </div>
  );
};

export default Index;
