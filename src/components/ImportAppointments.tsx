import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ImportAppointmentsProps {
  teamId: string;
  onImport: () => void;
}

interface AppointmentRow {
  lead_name: string;
  lead_email: string;
  start_at_utc: string;
}

export function ImportAppointments({ teamId, onImport }: ImportAppointmentsProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a CSV file",
        variant: "destructive",
      });
    }
  };

  const parseCSV = async (text: string): Promise<AppointmentRow[]> => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Find column indices
    const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('lead'));
    const emailIndex = headers.findIndex(h => h.includes('email'));
    const dateIndex = headers.findIndex(h => h.includes('date') || h.includes('time') || h.includes('start'));

    if (nameIndex === -1 || emailIndex === -1 || dateIndex === -1) {
      throw new Error('CSV must have columns for name, email, and date/time');
    }

    const appointments: AppointmentRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 3) continue;

      const name = values[nameIndex];
      const email = values[emailIndex];
      const dateStr = values[dateIndex];

      if (!name || !email || !dateStr) continue;

      // Parse the date - support various formats
      let date: Date;
      try {
        date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          console.warn(`Invalid date format for row ${i}: ${dateStr}`);
          continue;
        }
      } catch (error) {
        console.warn(`Could not parse date for row ${i}: ${dateStr}`);
        continue;
      }

      appointments.push({
        lead_name: name,
        lead_email: email,
        start_at_utc: date.toISOString(),
      });
    }

    return appointments;
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const text = await file.text();
      const appointments = await parseCSV(text);

      if (appointments.length === 0) {
        throw new Error('No valid appointments found in CSV');
      }

      // Insert appointments into database
      const appointmentsToInsert = appointments.map(apt => ({
        team_id: teamId,
        lead_name: apt.lead_name,
        lead_email: apt.lead_email,
        start_at_utc: apt.start_at_utc,
        status: 'NEW' as const,
      }));

      const { error } = await supabase
        .from('appointments')
        .insert(appointmentsToInsert);

      if (error) throw error;

      toast({
        title: "Import successful",
        description: `Successfully imported ${appointments.length} appointment(s)`,
      });

      setOpen(false);
      setFile(null);
      onImport();
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import Appointments
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import New Appointments</DialogTitle>
          <DialogDescription>
            Upload a CSV file with appointment data. Required columns: Lead Name, Email, Date/Time
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">CSV File</label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">CSV Format Example:</p>
            <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
              Lead Name,Email,Date/Time{'\n'}
              John Doe,john@example.com,2025-10-20 14:00{'\n'}
              Jane Smith,jane@example.com,2025-10-20 15:30
            </pre>
            <p className="text-xs text-muted-foreground">
              Date formats supported: ISO 8601, MM/DD/YYYY HH:MM, YYYY-MM-DD HH:MM
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? "Importing..." : "Import Appointments"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
