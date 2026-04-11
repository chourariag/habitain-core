import { format } from "date-fns";

export interface SubmissionWindow {
  isOpen: boolean;
  label: string;
  nextWindow: string;
}

export function getSubmissionWindow(): SubmissionWindow {
  const now = new Date();
  const day = now.getDate();
  if (day >= 1 && day <= 5) return { isOpen: true, label: "Window 1 open — closes on the 5th. Payment on 10th.", nextWindow: "" };
  if (day >= 16 && day <= 20) return { isOpen: true, label: "Window 2 open — closes on the 20th. Payment on 25th.", nextWindow: "" };
  if (day < 16) return { isOpen: false, label: "", nextWindow: `16th–20th ${format(now, "MMMM yyyy")}` };
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { isOpen: false, label: "", nextWindow: `1st–5th ${format(nextMonth, "MMMM yyyy")}` };
}
