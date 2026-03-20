import logoImg from "@/assets/logo.png";

export default function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <img src={logoImg} alt="Habitainer" className="h-16 w-16 rounded-full" />
      <h1 className="font-display text-2xl font-bold" style={{ color: "#006039" }}>Coming Soon</h1>
      <p className="text-sm" style={{ color: "#666666" }}>This module is under development.</p>
    </div>
  );
}
