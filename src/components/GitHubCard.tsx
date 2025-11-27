import { Github, ExternalLink, Cpu, Layers } from 'lucide-react';

export interface GitHubCardData {
  repo: string;
  url?: string;
  language?: string;
  stars?: number;
  forks?: number;
  description?: string;
}

interface GitHubCardProps {
  data: GitHubCardData;
}

export const GitHubCard = ({ data }: GitHubCardProps) => {
  const getRepoName = (str: string): string => {
    if (!str) return 'Unknown Repo';
    if (str.includes('[github.com/](https://github.com/)')) {
      return str.split('[github.com/](https://github.com/)')[1];
    }
    return str;
  };

  const repoName = getRepoName(data.repo);
  const repoUrl = data.url && data.url.startsWith('http') ? data.url : `https://github.com/${repoName}`;

  return (
    <div className="p-4 bg-black/30 backdrop-blur-md h-full flex flex-col text-cyan-50 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-2 opacity-30 group-hover:opacity-50 transition-opacity">
        <Github size={80} />
      </div>
      <div className="flex flex-col z-10">
        <div className="flex justify-between items-start mb-2">
          <a 
            href={repoUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-lg font-bold text-cyan-400 hover:text-pink-400 hover:underline cursor-pointer flex items-center gap-2 break-all relative z-50 text-glow-cyan hover:text-glow-pink"
            // 链接点击时阻止事件传播，避免触发卡片拖动
            onPointerDown={(e) => e.stopPropagation()}
          >
            {repoName}
            <ExternalLink size={14} />
          </a>
        </div>
        <span className="self-start text-[12px] border border-cyan-500/50 px-2 py-0.5 rounded-full text-cyan-300 mb-2 text-glow-cyan">
          {data.language || 'Code'}
        </span>
      </div>
      <p className={`text-sm mt-2 mb-4 font-mono leading-relaxed flex-grow ${
        data.description?.startsWith('Error:') 
          ? 'text-red-400 text-glow-red' 
          : data.description?.includes('Fetching') 
          ? 'text-amber-400 animate-pulse text-glow-amber' 
          : 'text-gray-200 text-glow-white'
      }`}>
        {data.description || 'No description provided.'}
      </p>
      <div className="flex items-center gap-4 text-xs font-mono text-pink-400 z-10 mt-auto text-glow-pink">
        <span className="flex items-center gap-1">
          <Cpu size={12}/> 
          {data.description?.includes('Fetching') ? '...' : (data.stars ?? 0)} Stars
        </span>
        <span className="flex items-center gap-1">
          <Layers size={12}/> 
          {data.description?.includes('Fetching') ? '...' : (data.forks ?? 0)} Forks
        </span>
      </div>
      
      {/* CRT Overlay */}
      <div className="absolute inset-0 pointer-events-none crt-overlay z-0" />
    </div>
  );
};

