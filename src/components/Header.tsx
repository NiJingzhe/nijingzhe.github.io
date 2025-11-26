interface HeaderProps {}

export const Header = ({}: HeaderProps) => {
  return (
    <div className="fixed top-6 left-6 z-50 flex flex-col gap-2">
      <h1 className="text-4xl font-black text-transparent bg-clip-text drop-shadow-[0_0_20px_rgba(236,72,153,0.8)]" style={{ 
        backgroundImage: 'linear-gradient(to right, rgb(244, 114, 182) 0%, rgb(59, 130, 246) 35%, rgb(34, 211, 238) 100%)',
        textShadow: '0 0 15px rgba(236, 72, 153, 0.9), 0 0 30px rgba(168, 85, 247, 0.7), 0 0 45px rgba(6, 182, 212, 0.6), 0 0 60px rgba(236, 72, 153, 0.4)' 
      }}>
        CYBER_SPACE <span className="text-xs align-top bg-cyan-600 text-black px-1">v1.0</span>
      </h1>
    </div>
  );
};

