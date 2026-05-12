import { SafetyIncidentsTab } from "@/components/safety/SafetyIncidentsTab";

export default function Safety() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Safety</h1>
        <p className="text-sm mt-1" style={{ color: "#666" }}>Report incidents and view the safety log. All employees can raise. Azad, Suraj and the MD review.</p>
      </div>
      <SafetyIncidentsTab />
    </div>
  );
}
