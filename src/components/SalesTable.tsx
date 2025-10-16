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
  setter: string;
  salesRep: string;
  date: string;
  revenue: number;
  setterCommission: number;
  commission: number;
  status: 'closed' | 'pending' | 'no-show';
  clientId?: string;
  clientName?: string;
}

interface SalesTableProps {
  sales: Sale[];
  userRole?: string | null;
}

export function SalesTable({ sales, userRole }: SalesTableProps) {
  const showCommissions = userRole === 'owner';
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
            <TableHead>Setter</TableHead>
            <TableHead>Closer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Revenue</TableHead>
            {showCommissions && <TableHead>Setter Commission</TableHead>}
            {showCommissions && <TableHead>Closer Commission</TableHead>}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale.id}>
              <TableCell className="font-medium">{sale.customerName}</TableCell>
              <TableCell>{sale.setter}</TableCell>
              <TableCell>{sale.salesRep}</TableCell>
              <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
              <TableCell>${sale.revenue.toLocaleString()}</TableCell>
              {showCommissions && (
                <TableCell className="text-primary font-semibold">
                  ${sale.setterCommission.toLocaleString()}
                </TableCell>
              )}
              {showCommissions && (
                <TableCell className="text-accent font-semibold">
                  ${sale.commission.toLocaleString()}
                </TableCell>
              )}
              <TableCell>{getStatusBadge(sale.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
