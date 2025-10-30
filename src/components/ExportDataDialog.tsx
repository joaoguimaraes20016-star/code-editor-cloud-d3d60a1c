import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { generateCSV, downloadCSV, ExportColumn, APPOINTMENT_COLUMNS, SALES_COLUMNS } from "@/lib/csvExport";
import { Download, Loader2 } from "lucide-react";

interface ExportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any[];
  type: "appointments" | "sales";
  filename: string;
}

export function ExportDataDialog({
  open,
  onOpenChange,
  data,
  type,
  filename,
}: ExportDataDialogProps) {
  const { toast } = useToast();
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set((type === "appointments" ? APPOINTMENT_COLUMNS : SALES_COLUMNS).map(c => c.key))
  );
  const [exporting, setExporting] = useState(false);

  const columns = type === "appointments" ? APPOINTMENT_COLUMNS : SALES_COLUMNS;

  const toggleColumn = (key: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedColumns(newSelected);
  };

  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      toast({
        title: "No columns selected",
        description: "Please select at least one column to export",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const exportColumns = columns.filter(col => selectedColumns.has(col.key));
      const csv = generateCSV(data, exportColumns);
      
      if (!csv) {
        toast({
          title: "No data to export",
          description: "There is no data matching your filters",
          variant: "destructive",
        });
        return;
      }

      downloadCSV(csv, filename);
      
      toast({
        title: "Export successful",
        description: `Exported ${data.length} records to ${filename}`,
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Export failed",
        description: "An error occurred while exporting data",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export to CSV</DialogTitle>
          <DialogDescription>
            Select which columns to include in the export ({data.length} records)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedColumns(new Set(columns.map(c => c.key)))}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedColumns(new Set())}
            >
              Deselect All
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {columns.map((col) => (
              <div key={col.key} className="flex items-center space-x-2">
                <Checkbox
                  id={col.key}
                  checked={selectedColumns.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <Label htmlFor={col.key} className="text-sm cursor-pointer">
                  {col.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export CSV
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
