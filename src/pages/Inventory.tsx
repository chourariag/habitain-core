export default function Inventory() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground text-sm mt-1">Material stock & purchase orders</p>
      </div>
      <div className="bg-card rounded-lg p-8 text-center shadow-sm">
        <p className="text-card-foreground/60 text-sm">Inventory management will appear here.</p>
      </div>
    </div>
  );
}
