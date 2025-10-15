import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface Sale {
  id: string;
  customerName: string;
  salesRep: string;
  date: string;
  revenue: number;
  commission: number;
  status: 'closed' | 'pending' | 'no-show';
}

interface SalesTableProps {
  sales: Sale[];
}

export function SalesTable({ sales }: SalesTableProps) {
  const getStatusBadge = (status: Sale['status']) => {
    const variants = {
      closed: 'default',
      pending: 'secondary',
      'no-show': 'destructive',
    } as const;

    const labels = {
      closed: 'Closed',
      pending: 'Pending',
      'no-show': 'No Show',
    };

    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Sales Rep</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Revenue</TableHead>
            <TableHead>Commission</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale.id}>
              <TableCell className="font-medium">{sale.customerName}</TableCell>
              <TableCell>{sale.salesRep}</TableCell>
              <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
              <TableCell>${sale.revenue.toLocaleString()}</TableCell>
              <TableCell className="text-accent font-semibold">
                ${sale.commission.toLocaleString()}
              </TableCell>
              <TableCell>{getStatusBadge(sale.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
