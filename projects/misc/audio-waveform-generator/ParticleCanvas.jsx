

export default function ParticleClock() {
  return (
    <div className="relative p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
      {/* Decorative background glow that respects reduced motion */}
      <div className="absolute inset-0 bg-purple-500/10 motion-safe:animate-pulse rounded-xl" />
      
      {/* Interactive elements with safe transitions */}
      <button className="transition-transform duration-200 motion-safe:hover:scale-105">
        Clock Action
      </button>
    </div>
  );
}
