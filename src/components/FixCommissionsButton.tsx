import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FixCommissionsButtonProps {
  teamId: string;
  onFixed?: () => void;
}

export function FixCommissionsButton({ teamId, onFixed }: FixCommissionsButtonProps) {
  const { toast } = useToast();
  const [fixing, setFixing] = useState(false);

  const handleFix = async () => {
    setFixing(true);
    try {
      // Get all sales for this team
      const { data: sales, error: fetchError } = await supabase
        .from('sales')
        .select('id, revenue, setter, commission, setter_commission')
        .eq('team_id', teamId);

      if (fetchError) throw fetchError;

      let fixed = 0;
      let errors = 0;

      // Recalculate commissions for each sale
      for (const sale of sales || []) {
        const revenue = Number(sale.revenue) || 0;
        const correctCloserCommission = revenue * 0.10; // 10%
        const correctSetterCommission = sale.setter && sale.setter !== 'No Setter' ? revenue * 0.05 : 0; // 5%

        // Check if commissions need fixing (allowing small floating point differences)
        const needsFix = 
          Math.abs((sale.commission || 0) - correctCloserCommission) > 0.01 ||
          Math.abs((sale.setter_commission || 0) - correctSetterCommission) > 0.01;

        if (needsFix) {
          const { error: updateError } = await supabase
            .from('sales')
            .update({
              commission: correctCloserCommission,
              setter_commission: correctSetterCommission,
            })
            .eq('id', sale.id);

          if (updateError) {
            console.error(`Error updating sale ${sale.id}:`, updateError);
            errors++;
          } else {
            fixed++;
          }
        }
      }

      toast({
        title: 'Commission Fix Complete',
        description: `Fixed ${fixed} sales${errors > 0 ? `, ${errors} errors` : ''}`,
      });

      onFixed?.();
    } catch (error: any) {
      toast({
        title: 'Error fixing commissions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setFixing(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Recalculate Commissions
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recalculate All Commissions</AlertDialogTitle>
          <AlertDialogDescription>
            This will recalculate all commission values based on the current rules (10% for closers, 5% for setters on CC). 
            This fixes any sales that may have incorrect commission values.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={fixing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleFix} disabled={fixing}>
            {fixing ? 'Fixing...' : 'Fix Commissions'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}