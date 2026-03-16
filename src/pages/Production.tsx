export default function Production() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Production</h1>
        <p className="text-muted-foreground text-sm mt-1">Module production tracking & stage progress</p>
      </div>
      <div className="bg-card rounded-lg p-8 text-center shadow-sm">
        <p className="text-card-foreground/60 text-sm">Production tracker will show module stages here.</p>
      </div>
    </div>
  );
}
