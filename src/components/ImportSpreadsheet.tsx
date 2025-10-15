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

interface ImportSpreadsheetProps {
  onImport: (sales: Omit<Sale, 'id'>[]) => void;
}

export function ImportSpreadsheet({ onImport }: ImportSpreadsheetProps) {
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
      
      // Skip header row
      const dataLines = lines.slice(1);
      
      const importedSales: Omit<Sale, 'id'>[] = dataLines
        .map(line => {
          const [customerName, setter, salesRep, date, revenue, setterCommission, commission, status] = line.split(',').map(s => s.trim());
          
          return {
            customerName,
            setter,
            salesRep,
            date,
            revenue: parseFloat(revenue) || 0,
            setterCommission: parseFloat(setterCommission) || 0,
            commission: parseFloat(commission) || 0,
            status: (status as Sale['status']) || 'pending',
          };
        })
        .filter(sale => sale.customerName && sale.setter && sale.salesRep);

      if (importedSales.length > 0) {
        onImport(importedSales);
        toast({
          title: "Import Successful",
          description: `Imported ${importedSales.length} sales records`,
        });
        setOpen(false);
      } else {
        toast({
          title: "Import Failed",
          description: "No valid sales data found in the file",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Error parsing the CSV file. Please check the format.",
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
            Upload a CSV file with your sales data. The file should have the following columns:
            Customer Name, Setter, Closer, Date, Revenue, Setter Commission, Closer Commission, Status
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
            <p className="text-sm font-medium mb-2">Expected CSV Format:</p>
            <code className="text-xs block bg-card p-2 rounded overflow-x-auto">
              Customer Name, Setter, Closer, Date, Revenue, Setter Commission, Closer Commission, Status<br />
              Acme Corp, Sarah Lee, John Doe, 2025-10-10, 15000, 300, 1500, closed<br />
              TechStart Inc, Mike Ross, Jane Smith, 2025-10-12, 8500, 170, 850, closed
            </code>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
