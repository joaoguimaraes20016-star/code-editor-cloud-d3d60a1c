import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SetterEODReport } from "./SetterEODReport";
import { CloserEODReport } from "./CloserEODReport";
import { MonthlyCommissionReport } from "./MonthlyCommissionReport";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface EODDashboardProps {
  teamId: string;
  userRole: string;
  currentUserId: string;
  currentUserName: string;
}

export function EODDashboard({ teamId, userRole, currentUserId, currentUserName }: EODDashboardProps) {
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUserId);

  useEffect(() => {
    loadTeamMembers();
  }, [teamId]);

  const loadTeamMembers = async () => {
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId)
      .eq('is_active', true);

    if (members) {
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profiles) {
        setTeamMembers(profiles.map(p => ({
          id: p.id,
          name: p.full_name,
          role: members.find(m => m.user_id === p.id)?.role
        })));
      }
    }
  };

  const isAdmin = userRole === 'admin' || userRole === 'offer_owner';
  const setters = teamMembers.filter(m => m.role === 'setter');
  const closers = teamMembers.filter(m => m.role === 'closer' || m.role === 'offer_owner');

  const selectedUser = teamMembers.find(m => m.id === selectedUserId) || { 
    id: currentUserId, 
    name: currentUserName, 
    role: userRole 
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          End-of-Day Reports & Commission Tracking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="today">Today's Activity</TabsTrigger>
            {isAdmin && <TabsTrigger value="team">Team Overview</TabsTrigger>}
            <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
            <TabsTrigger value="historical">Historical</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-6 mt-6">
            {userRole === 'setter' && (
              <SetterEODReport
                teamId={teamId}
                userId={currentUserId}
                userName={currentUserName}
                date={new Date()}
              />
            )}
            
            {(userRole === 'closer' || userRole === 'offer_owner') && (
              <CloserEODReport
                teamId={teamId}
                userId={currentUserId}
                userName={currentUserName}
                date={new Date()}
              />
            )}

            {userRole === 'admin' && (
              <div className="space-y-6">
                <SetterEODReport
                  teamId={teamId}
                  userId={currentUserId}
                  userName={currentUserName}
                  date={new Date()}
                />
                <CloserEODReport
                  teamId={teamId}
                  userId={currentUserId}
                  userName={currentUserName}
                  date={new Date()}
                />
              </div>
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="team" className="space-y-6 mt-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  📞 Setters Activity
                </h3>
                {setters.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No active setters found</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {setters.map(setter => (
                      <SetterEODReport
                        key={setter.id}
                        teamId={teamId}
                        userId={setter.id}
                        userName={setter.name}
                        date={new Date()}
                        compact={true}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  💰 Closers Activity
                </h3>
                {closers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No active closers found</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {closers.map(closer => (
                      <CloserEODReport
                        key={closer.id}
                        teamId={teamId}
                        userId={closer.id}
                        userName={closer.name}
                        date={new Date()}
                        compact={true}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          <TabsContent value="monthly" className="mt-6">
            <MonthlyCommissionReport teamId={teamId} />
          </TabsContent>

          <TabsContent value="historical" className="space-y-6 mt-6">
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {isAdmin && (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Members</SelectItem>
                    {teamMembers.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedUserId === 'all' ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Setters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {setters.map(setter => (
                      <SetterEODReport
                        key={setter.id}
                        teamId={teamId}
                        userId={setter.id}
                        userName={setter.name}
                        date={selectedDate}
                        compact={true}
                      />
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Closers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {closers.map(closer => (
                      <CloserEODReport
                        key={closer.id}
                        teamId={teamId}
                        userId={closer.id}
                        userName={closer.name}
                        date={selectedDate}
                        compact={true}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {selectedUser.role === 'setter' ? (
                  <SetterEODReport
                    teamId={teamId}
                    userId={selectedUser.id}
                    userName={selectedUser.name}
                    date={selectedDate}
                  />
                ) : (
                  <CloserEODReport
                    teamId={teamId}
                    userId={selectedUser.id}
                    userName={selectedUser.name}
                    date={selectedDate}
                  />
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
