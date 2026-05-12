export type InvoiceRow = {
  id: string;
  vendor: string;
  date: string;
  amount: number;
  suggestedRail: "Credit Card" | "A2A";
  category: string | null;
  due_date: string | null;
  status: string | null;
  confidence_score: number | null;
};
