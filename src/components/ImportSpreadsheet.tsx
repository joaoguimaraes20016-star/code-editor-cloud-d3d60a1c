import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Sale } from "./SalesTable";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ImportSpreadsheetProps {
  teamId: string;
  onImport: () => void;
}

export function ImportSpreadsheet({ teamId, onImport }: ImportSpreadsheetProps) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV file is empty or has no data rows");
      }

      // Get header row and find column indices
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      const dataLines = lines.slice(1);
      
      // Find column indices
      const getColumnIndex = (possibleNames: string[]) => {
        return possibleNames
          .map(name => headers.indexOf(name))
          .find(idx => idx !== -1) ?? -1;
      };

      const customerIdx = getColumnIndex(['customer name', 'customer', 'prospect name', 'prospect']);
      const offerOwnerIdx = getColumnIndex(['offer owner', 'owner']);
      const setterIdx = getColumnIndex(['setter', 'setter name']);
      const closerIdx = getColumnIndex(['closer', 'closer name', 'sales rep', 'salesrep']);
      const dateIdx = getColumnIndex(['date', 'close date', 'closed date']);
      const revenueIdx = getColumnIndex(['revenue', 'amount', 'deal value']);
      const setterCommissionIdx = getColumnIndex(['setter commission', 'setter comm']);
      const closerCommissionIdx = getColumnIndex(['closer commission', 'closer comm', 'commission']);
      const statusIdx = getColumnIndex(['status']);
      const mrrIdx = getColumnIndex(['mrr', 'mrr amount', 'monthly recurring']);
      const mrrMonthsIdx = getColumnIndex(['mrr months', 'months', 'duration']);
      const emailIdx = getColumnIndex(['email', 'prospect email', 'customer email']);

      let successCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        try {
          const columns = line.split(',').map(s => s.trim());
          
          const customerName = customerIdx >= 0 ? columns[customerIdx] : '';
          const setter = setterIdx >= 0 ? columns[setterIdx] : '';
          const closer = closerIdx >= 0 ? columns[closerIdx] : '';
          
          if (!customerName || !closer) {
            errorCount++;
            continue;
          }

          const offerOwner = offerOwnerIdx >= 0 ? columns[offerOwnerIdx] : '';
          const date = dateIdx >= 0 ? columns[dateIdx] : new Date().toISOString().split('T')[0];
          const revenue = revenueIdx >= 0 ? parseFloat(columns[revenueIdx]) || 0 : 0;
          const setterCommission = setterCommissionIdx >= 0 ? parseFloat(columns[setterCommissionIdx]) || 0 : 0;
          const closerCommission = closerCommissionIdx >= 0 ? parseFloat(columns[closerCommissionIdx]) || 0 : 0;
          const status = statusIdx >= 0 ? columns[statusIdx] : 'closed';
          const mrr = mrrIdx >= 0 ? parseFloat(columns[mrrIdx]) || 0 : 0;
          const mrrMonths = mrrMonthsIdx >= 0 ? parseInt(columns[mrrMonthsIdx]) || 0 : 0;
          const email = emailIdx >= 0 ? columns[emailIdx] : '';

          // Insert into sales table
          const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert({
              team_id: teamId,
              customer_name: customerName,
              offer_owner: offerOwner,
              setter: setter || null,
              sales_rep: closer,
              date: date,
              revenue: revenue,
              setter_commission: setterCommission,
              commission: closerCommission,
              status: status,
            })
            .select()
            .single();

          if (saleError) throw saleError;

          // Create appointment record if we have email
          if (email && saleData) {
            const { data: teamMembers } = await supabase
              .from('team_members')
              .select('user_id, profiles(full_name)')
              .eq('team_id', teamId);

            const closerMember = teamMembers?.find(
              tm => (tm.profiles as any)?.full_name?.toLowerCase() === closer.toLowerCase()
            );

            const { error: appointmentError } = await supabase
              .from('appointments')
              .insert([{
                team_id: teamId,
                lead_name: customerName,
                lead_email: email,
                start_at_utc: new Date(date).toISOString(),
                event_type_name: 'Imported',
                closer_id: closerMember?.user_id || null,
                closer_name: closer,
                status: 'CLOSED' as const,
                revenue: revenue,
                mrr_amount: mrr > 0 ? mrr : null,
                mrr_months: mrrMonths > 0 ? mrrMonths : null,
              }]);

            if (appointmentError) console.error('Appointment insert error:', appointmentError);
          }

          // Create MRR commission records if MRR data exists
          if (mrr > 0 && mrrMonths > 0 && saleData) {
            const { startOfMonth, addMonths, format } = await import('date-fns');
            const mrrCommissions = [];
            
            for (let i = 1; i <= mrrMonths; i++) {
              const monthDate = startOfMonth(addMonths(new Date(), i));
              
              // Closer MRR commission
              if (closer !== offerOwner) {
                mrrCommissions.push({
                  team_id: teamId,
                  sale_id: saleData.id,
                  team_member_name: closer,
                  role: 'closer',
                  prospect_name: customerName,
                  prospect_email: email,
                  month_date: format(monthDate, 'yyyy-MM-dd'),
                  mrr_amount: mrr,
                  commission_amount: closerCommission > 0 ? mrr * (closerCommission / revenue) : 0,
                  commission_percentage: closerCommission > 0 ? (closerCommission / revenue) * 100 : 0,
                });
              }

              // Setter MRR commission
              if (setter) {
                mrrCommissions.push({
                  team_id: teamId,
                  sale_id: saleData.id,
                  team_member_name: setter,
                  role: 'setter',
                  prospect_name: customerName,
                  prospect_email: email,
                  month_date: format(monthDate, 'yyyy-MM-dd'),
                  mrr_amount: mrr,
                  commission_amount: setterCommission > 0 ? mrr * (setterCommission / revenue) : 0,
                  commission_percentage: setterCommission > 0 ? (setterCommission / revenue) * 100 : 0,
                });
              }
            }

            if (mrrCommissions.length > 0) {
              const { error: mrrError } = await supabase
                .from('mrr_commissions')
                .insert(mrrCommissions);

              if (mrrError) console.error('MRR commission insert error:', mrrError);
            }
          }

          successCount++;
        } catch (rowError: any) {
          console.error('Error processing row:', rowError);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Import Successful",
          description: `Imported ${successCount} records${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        });
        onImport();
        setOpen(false);
      } else {
        toast({
          title: "Import Failed",
          description: "No valid data could be imported. Please check the format.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Error parsing the CSV file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Sales Data</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your old closed deals. The importer will automatically detect columns.
            Required: Customer Name, Closer. Optional: Offer Owner, Setter, Email, Date, Revenue, Commissions, MRR, MRR Months, Status
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Choose CSV File"}
              </Button>
            </label>
            <p className="text-sm text-muted-foreground mt-2">
              or drag and drop your file here
            </p>
          </div>

          <div className="bg-secondary/50 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Example CSV Format:</p>
            <code className="text-xs block bg-card p-2 rounded overflow-x-auto">
              Customer Name,Email,Closer,Setter,Offer Owner,Date,Revenue,Setter Commission,Closer Commission,Status,MRR,MRR Months<br />
              Acme Corp,john@acme.com,John Doe,Sarah Lee,Jane Admin,2025-10-10,15000,300,1500,closed,500,12<br />
              TechStart,mike@tech.com,Jane Smith,Mike Ross,,2025-10-12,8500,170,850,closed,0,0
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              * Column order doesn't matter - the importer auto-detects columns by name
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
