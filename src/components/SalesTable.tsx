import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Sale {
  id: string;
  customerName: string;
  offerOwner: string;
  setter: string;
  salesRep: string;
  date: string;
  revenue: number;
  setterCommission: number;
  commission: number;
  status: 'closed' | 'pending' | 'no-show';
  isAppointment?: boolean; // Flag to distinguish appointments from manual sales
  productName?: string;
}

interface SalesTableProps {
  sales: Sale[];
  userRole?: string | null;
  currentUserName?: string | null;
  onSaleDeleted?: () => void;
  teamMembers?: Array<{ id: string; name: string }>;
}

export function SalesTable({ sales, userRole, currentUserName, onSaleDeleted, teamMembers = [] }: SalesTableProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingSetter, setEditingSetter] = useState<string | null>(null);
  const [editingCloser, setEditingCloser] = useState<string | null>(null);
  const [editingSetterCommission, setEditingSetterCommission] = useState<string | null>(null);
  const [editingCloserCommission, setEditingCloserCommission] = useState<string | null>(null);
  const [tempSetterCommission, setTempSetterCommission] = useState("");
  const [tempCloserCommission, setTempCloserCommission] = useState("");

  const canEdit = userRole === 'admin' || userRole === 'offer_owner';

  const canDelete = (sale: Sale) => {
    return userRole === 'admin' || userRole === 'offer_owner' || sale.offerOwner === currentUserName;
  };

  const handleDeleteClick = (sale: Sale) => {
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!saleToDelete) return;

    setDeleting(true);
    try {
      if (saleToDelete.isAppointment) {
        // This is an appointment being displayed as a sale - delete the appointment
        const { error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', saleToDelete.id);

        if (error) throw error;

        toast({
          title: 'Appointment deleted',
          description: 'The appointment and deposit have been removed successfully',
        });
      } else {
        // This is a manual sale record - delete MRR commissions and sale
        const { error: mrrError } = await supabase
          .from('mrr_commissions')
          .delete()
          .eq('sale_id', saleToDelete.id);

        if (mrrError) throw mrrError;

        const { error } = await supabase
          .from('sales')
          .delete()
          .eq('id', saleToDelete.id);

        if (error) throw error;

        toast({
          title: 'Sale deleted',
          description: 'The transaction and MRR commissions have been removed successfully',
        });
      }

      onSaleDeleted?.();
    } catch (error: any) {
      toast({
        title: 'Error deleting sale',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
    }
  };

  const handleSetterChange = async (saleId: string, newSetter: string) => {
    try {
      const { error } = await supabase
        .from('sales')
        .update({ setter: newSetter })
        .eq('id', saleId);

      if (error) throw error;

      toast({
        title: 'Setter updated',
        description: 'The setter has been updated successfully',
      });

      setEditingSetter(null);
      onSaleDeleted?.(); // Refresh data
    } catch (error: any) {
      toast({
        title: 'Error updating setter',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCloserChange = async (saleId: string, newCloser: string) => {
    try {
      const { error } = await supabase
        .from('sales')
        .update({ sales_rep: newCloser })
        .eq('id', saleId);

      if (error) throw error;

      toast({
        title: 'Closer updated',
        description: 'The closer has been updated successfully',
      });

      setEditingCloser(null);
      onSaleDeleted?.(); // Refresh data
    } catch (error: any) {
      toast({
        title: 'Error updating closer',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSetterCommissionChange = async (saleId: string) => {
    const newCommission = parseFloat(tempSetterCommission);
    
    if (isNaN(newCommission) || newCommission < 0) {
      toast({
        title: 'Invalid commission',
        description: 'Please enter a valid commission amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('sales')
        .update({ setter_commission: newCommission })
        .eq('id', saleId);

      if (error) throw error;

      toast({
        title: 'Commission updated',
        description: 'Setter commission has been updated successfully',
      });

      setEditingSetterCommission(null);
      setTempSetterCommission("");
      onSaleDeleted?.(); // Refresh data
    } catch (error: any) {
      toast({
        title: 'Error updating commission',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCloserCommissionChange = async (saleId: string) => {
    const newCommission = parseFloat(tempCloserCommission);
    
    if (isNaN(newCommission) || newCommission < 0) {
      toast({
        title: 'Invalid commission',
        description: 'Please enter a valid commission amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('sales')
        .update({ commission: newCommission })
        .eq('id', saleId);

      if (error) throw error;

      toast({
        title: 'Commission updated',
        description: 'Closer commission has been updated successfully',
      });

      setEditingCloserCommission(null);
      setTempCloserCommission("");
      onSaleDeleted?.(); // Refresh data
    } catch (error: any) {
      toast({
        title: 'Error updating commission',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

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
    <>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Setter</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Setter Commission</TableHead>
              <TableHead>Closer Commission</TableHead>
              <TableHead>Status</TableHead>
              {userRole === 'admin' || userRole === 'offer_owner' ? (
                <TableHead className="w-[100px]">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-medium">{sale.customerName}</TableCell>
                <TableCell className="text-muted-foreground">{sale.productName || '-'}</TableCell>
                <TableCell>
                  {canEdit && editingSetter === sale.id ? (
                    <Select
                      value={sale.setter}
                      onValueChange={(value) => handleSetterChange(sale.id, value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.name || "Unknown"}>
                            {member.name || "Unknown"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div 
                      onClick={() => canEdit && setEditingSetter(sale.id)}
                      className={canEdit ? 'cursor-pointer hover:text-primary' : ''}
                    >
                      {sale.setter}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {canEdit && editingCloser === sale.id ? (
                    <Select
                      value={sale.salesRep}
                      onValueChange={(value) => handleCloserChange(sale.id, value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.name || "Unknown"}>
                            {member.name || "Unknown"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div 
                      onClick={() => canEdit && setEditingCloser(sale.id)}
                      className={canEdit ? 'cursor-pointer hover:text-primary' : ''}
                    >
                      {sale.salesRep}
                    </div>
                  )}
                </TableCell>
                <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                <TableCell>${sale.revenue.toLocaleString()}</TableCell>
                <TableCell className="text-primary font-semibold">
                  {canEdit && editingSetterCommission === sale.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={tempSetterCommission}
                        onChange={(e) => setTempSetterCommission(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSetterCommissionChange(sale.id);
                          if (e.key === 'Escape') {
                            setEditingSetterCommission(null);
                            setTempSetterCommission("");
                          }
                        }}
                        className="w-24"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetterCommissionChange(sale.id)}
                      >
                        ✓
                      </Button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        if (canEdit && sale.setter) {
                          setEditingSetterCommission(sale.id);
                          setTempSetterCommission((sale.setterCommission || 0).toString());
                        }
                      }}
                      className={canEdit && sale.setter ? 'cursor-pointer hover:underline' : ''}
                    >
                      ${!sale.setter || sale.setter.trim() === '' ? '0' : (sale.setterCommission || 0).toLocaleString()}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-accent font-semibold">
                  {canEdit && editingCloserCommission === sale.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={tempCloserCommission}
                        onChange={(e) => setTempCloserCommission(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCloserCommissionChange(sale.id);
                          if (e.key === 'Escape') {
                            setEditingCloserCommission(null);
                            setTempCloserCommission("");
                          }
                        }}
                        className="w-24"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCloserCommissionChange(sale.id)}
                      >
                        ✓
                      </Button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        if (canEdit) {
                          setEditingCloserCommission(sale.id);
                          setTempCloserCommission((sale.commission || 0).toString());
                        }
                      }}
                      className={canEdit ? 'cursor-pointer hover:underline' : ''}
                    >
                      ${(sale.commission || 0).toLocaleString()}
                    </div>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(sale.status)}</TableCell>
                {(userRole === 'admin' || userRole === 'offer_owner') && (
                  <TableCell>
                    {canDelete(sale) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(sale)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
            Are you sure you want to delete this transaction for {saleToDelete?.customerName}? 
              This will permanently remove ${saleToDelete?.revenue.toLocaleString()} in revenue, all associated commissions, and any MRR commissions. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
