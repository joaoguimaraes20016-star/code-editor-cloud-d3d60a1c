/**
 * CSV Export Utilities
 * Generates CSV files from data arrays
 */

export interface ExportColumn {
  key: string;
  label: string;
}

export function generateCSV(data: any[], columns: ExportColumn[]): string {
  if (data.length === 0) return "";

  // Create header row
  const headers = columns.map(col => escapeCSVValue(col.label)).join(",");
  
  // Create data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      return escapeCSVValue(formatValue(value));
    }).join(",");
  });

  return [headers, ...rows].join("\n");
}

function escapeCSVValue(value: any): string {
  const str = String(value ?? "");
  
  // If contains comma, newline, or quotes, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return value.toString();
  return String(value);
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Preset column configurations for common exports
export const APPOINTMENT_COLUMNS: ExportColumn[] = [
  { key: "lead_name", label: "Lead Name" },
  { key: "lead_email", label: "Email" },
  { key: "lead_phone", label: "Phone" },
  { key: "start_at_utc", label: "Appointment Date" },
  { key: "status", label: "Status" },
  { key: "pipeline_stage", label: "Stage" },
  { key: "setter_name", label: "Setter" },
  { key: "closer_name", label: "Closer" },
  { key: "event_type_name", label: "Event Type" },
  { key: "cc_collected", label: "Cash Collected" },
  { key: "mrr_amount", label: "MRR Amount" },
  { key: "mrr_months", label: "MRR Months" },
  { key: "setter_notes", label: "Notes" },
  { key: "product_name", label: "Product" },
];

export const SALES_COLUMNS: ExportColumn[] = [
  { key: "date", label: "Date" },
  { key: "customer_name", label: "Customer" },
  { key: "sales_rep", label: "Sales Rep" },
  { key: "setter", label: "Setter" },
  { key: "product_name", label: "Product" },
  { key: "revenue", label: "Revenue" },
  { key: "commission", label: "Commission" },
  { key: "setter_commission", label: "Setter Commission" },
  { key: "status", label: "Status" },
];

export const FUNNEL_LEAD_COLUMNS: ExportColumn[] = [
  { key: "created_at", label: "Submitted At" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
  { key: "opt_in_status", label: "Opted In" },
  { key: "utm_source", label: "UTM Source" },
  { key: "utm_medium", label: "UTM Medium" },
  { key: "utm_campaign", label: "UTM Campaign" },
];

export const CONTACT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "First Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "opt_in", label: "Opt In" },
  { key: "source", label: "Lead Source" },
  { key: "tags", label: "Tags" },
  { key: "created_at", label: "Date Added" },
  { key: "updated_at", label: "Last Updated" },
];
