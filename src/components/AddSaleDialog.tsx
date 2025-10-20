import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useParams } from "react-router-dom";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface AddSaleDialogProps {
  onAddSale: (sale: {
    customerName: string;
    setterId: string;
    setter: string;
    salesRepId: string;
    salesRep: string;
    offerOwner: string;
    productName: string;
    date: string;
    ccCollected: number;
    mrrAmount: number;
    mrrMonths: number;
    status: 'closed' | 'pending' | 'no-show';
  }) => void;
}

export function AddSaleDialog({ onAddSale }: AddSaleDialogProps) {
  const { teamId } = useParams();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [offerOwner, setOfferOwner] = useState("");
  const [productName, setProductName] = useState("");
  const [setterId, setSetterId] = useState("");
  const [salesRepId, setSalesRepId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [ccCollected, setCcCollected] = useState("");
  const [mrrAmount, setMrrAmount] = useState("");
  const [mrrMonths, setMrrMonths] = useState("");
  const [status, setStatus] = useState<'closed' | 'pending' | 'no-show'>("closed");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (open && teamId) {
      loadTeamMembers();
    }
  }, [open, teamId]);

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (
            full_name
          )
        `)
        .eq('team_id', teamId);

      if (error) throw error;

      const members = data?.map(member => ({
        id: member.id,
        user_id: member.user_id,
        full_name: (member.profiles as any)?.full_name || 'Unknown',
        role: member.role
      })) || [];

      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedSetter = teamMembers.find(m => m.user_id === setterId);
    const selectedCloser = teamMembers.find(m => m.user_id === salesRepId);
    
    onAddSale({
      customerName,
      setterId,
      setter: selectedSetter?.full_name || '',
      salesRepId,
      salesRep: selectedCloser?.full_name || '',
      offerOwner,
      productName,
      date,
      ccCollected: parseFloat(ccCollected) || 0,
      mrrAmount: parseFloat(mrrAmount) || 0,
      mrrMonths: parseInt(mrrMonths) || 0,
      status,
    });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setCustomerName("");
    setOfferOwner("");
    setProductName("");
    setSetterId("");
    setSalesRepId("");
    setDate(new Date().toISOString().split('T')[0]);
    setCcCollected("");
    setMrrAmount("");
    setMrrMonths("");
    setStatus("closed");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="text-sm md:text-base w-full sm:w-auto">
          <Plus className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
          Add Sale
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
        <DialogHeader>
          <DialogTitle>Add New Sale</DialogTitle>
          <DialogDescription>
            Enter the details of the new sale transaction.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="offerOwner">Offer Owner</Label>
              <Input
                id="offerOwner"
                value={offerOwner}
                onChange={(e) => setOfferOwner(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Premium Coaching Program"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="setter">Setter</Label>
              <Select value={setterId} onValueChange={setSetterId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select setter" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers
                    .filter(m => m.role === 'setter' || m.role === 'admin' || m.role === 'owner')
                    .map(member => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="salesRep">Closer</Label>
              <Select value={salesRepId} onValueChange={setSalesRepId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select closer" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers
                    .filter(m => m.role === 'closer' || m.role === 'admin' || m.role === 'owner')
                    .map(member => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ccCollected">Cash Collected (CC)</Label>
              <Input
                id="ccCollected"
                type="number"
                step="0.01"
                value={ccCollected}
                onChange={(e) => setCcCollected(e.target.value)}
                placeholder="10000"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mrrAmount">MRR Amount (Monthly)</Label>
              <Input
                id="mrrAmount"
                type="number"
                step="0.01"
                value={mrrAmount}
                onChange={(e) => setMrrAmount(e.target.value)}
                placeholder="500"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mrrMonths">MRR Months</Label>
              <Input
                id="mrrMonths"
                type="number"
                value={mrrMonths}
                onChange={(e) => setMrrMonths(e.target.value)}
                placeholder="12"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as 'closed' | 'pending' | 'no-show')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="no-show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Add Sale</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
