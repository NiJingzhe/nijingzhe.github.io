import { useEffect, useState } from 'react';

export const GlitchTransition = ({ onComplete }: { onComplete: () => void }) => {
  const [blocks, setBlocks] = useState<Array<{ id: number; style: React.CSSProperties; color: string }>>([]);

  useEffect(() => {
    // Generate random glitch blocks
    // Removed white to reduce brightness
    const colors = ['#00ffff', '#ff00ff', '#ffff00', '#000000', '#4b0082']; 
    const newBlocks = Array.from({ length: 15 }).map((_, i) => ({ // Reduced count slightly
      id: i,
      style: {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        width: `${Math.random() * 40 + 10}%`,
        height: `${Math.random() * 20 + 2}%`,
        transform: `translate(-50%, -50%)`,
        opacity: Math.random() * 0.8, // Reduced max opacity
        animationDelay: `${Math.random() * 0.05}s`, // Faster animation start
      },
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setBlocks(newBlocks);

    const timer = setTimeout(() => {
      onComplete();
    }, 200); // Duration of the glitch effect - Reduced to 200ms

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden flex flex-col">
      {/* Background flash - Removed white flash, added subtle dark overlay */}
      <div className="absolute inset-0 bg-black/20 mix-blend-overlay"></div>
      
      {/* Random blocks */}
      {blocks.map((block) => (
        <div
          key={block.id}
          className="absolute animate-glitch-block"
          style={{
            ...block.style,
            backgroundColor: block.color,
            mixBlendMode: 'exclusion',
          }}
        />
      ))}
      
      {/* Scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50"></div>
    </div>
  );
};
