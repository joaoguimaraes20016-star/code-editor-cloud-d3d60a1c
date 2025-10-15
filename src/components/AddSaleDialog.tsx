import { useState } from "react";
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
import { Sale } from "./SalesTable";

interface AddSaleDialogProps {
  onAddSale: (sale: Omit<Sale, 'id'>) => void;
}

export function AddSaleDialog({ onAddSale }: AddSaleDialogProps) {
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [setter, setSetter] = useState("");
  const [salesRep, setSalesRep] = useState("");
  const [date, setDate] = useState("");
  const [revenue, setRevenue] = useState("");
  const [setterCommission, setSetterCommission] = useState("");
  const [commission, setCommission] = useState("");
  const [status, setStatus] = useState<Sale['status']>("pending");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddSale({
      customerName,
      setter,
      salesRep,
      date,
      revenue: parseFloat(revenue),
      setterCommission: parseFloat(setterCommission),
      commission: parseFloat(commission),
      status,
    });
    setCustomerName("");
    setSetter("");
    setSalesRep("");
    setDate("");
    setRevenue("");
    setSetterCommission("");
    setCommission("");
    setStatus("pending");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Sale
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Sale</DialogTitle>
          <DialogDescription>
            Enter the details of the new sale transaction.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="customer">Customer Name</Label>
              <Input
                id="customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setter">Setter</Label>
              <Input
                id="setter"
                value={setter}
                onChange={(e) => setSetter(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="salesRep">Closer</Label>
              <Input
                id="salesRep"
                value={salesRep}
                onChange={(e) => setSalesRep(e.target.value)}
                required
              />
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
              <Label htmlFor="revenue">Revenue</Label>
              <Input
                id="revenue"
                type="number"
                step="0.01"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setterCommission">Setter Commission</Label>
              <Input
                id="setterCommission"
                type="number"
                step="0.01"
                value={setterCommission}
                onChange={(e) => setSetterCommission(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="commission">Closer Commission</Label>
              <Input
                id="commission"
                type="number"
                step="0.01"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as Sale['status'])}>
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
