export default function AppSettings() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">System configuration</p>
      </div>
      <div className="bg-card rounded-lg p-8 text-center shadow-sm">
        <p className="text-card-foreground/60 text-sm">Settings panel will appear here.</p>
      </div>
    </div>
  );
}
