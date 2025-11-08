import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DataRecoveryPanelProps {
  teamId: string;
}

export function DataRecoveryPanel({ teamId }: DataRecoveryPanelProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleScan = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('recover-appointments', {
        body: {
          teamId,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
        }
      });

      if (error) throw error;
      
      setResults(data);
      
      if (data.missingAppointments === 0) {
        toast.success('No missing appointments found');
      } else {
        toast.warning(`Found ${data.missingAppointments} missing appointment(s)`);
      }
    } catch (error: any) {
      toast.error('Failed to scan for missing appointments');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverAppointment = async (appointmentData: any) => {
    try {
      // Create appointment manually
      const { error } = await supabase.from('appointments').insert({
        team_id: teamId,
        lead_name: appointmentData.lead_name,
        lead_email: appointmentData.lead_email,
        start_at_utc: appointmentData.start_at_utc,
        status: 'NEW',
        pipeline_stage: 'booked',
        calendly_invitee_uri: appointmentData.invitee.uri,
      });

      if (error) throw error;
      
      toast.success('Appointment recovered successfully');
      
      // Refresh results
      handleScan();
    } catch (error: any) {
      toast.error('Failed to recover appointment');
      console.error(error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Data Recovery
        </CardTitle>
        <CardDescription>
          Scan for missed appointments from Calendly and recover them
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleScan} disabled={loading} className="w-full">
          <Search className="h-4 w-4 mr-2" />
          {loading ? 'Scanning...' : 'Scan for Missing Appointments'}
        </Button>

        {results && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{results.totalCalendlyEvents}</p>
                <p className="text-xs text-muted-foreground">Calendly Events</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{results.existingInDatabase}</p>
                <p className="text-xs text-muted-foreground">In Database</p>
              </div>
              <div className="text-center p-3 bg-destructive/10 rounded-lg">
                <p className="text-2xl font-bold text-destructive">{results.missingAppointments}</p>
                <p className="text-xs text-muted-foreground">Missing</p>
              </div>
            </div>

            {results.details && results.details.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Missing Appointments
                </h4>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {results.details.map((appointment: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{appointment.lead_name}</p>
                            <p className="text-sm text-muted-foreground">{appointment.lead_email}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(appointment.start_at_utc).toLocaleString()}
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRecoverAppointment(appointment)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Recover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}