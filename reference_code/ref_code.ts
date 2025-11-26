import React, { useState, useRef, useEffect } from 'react';
import { Move, X, Github, Globe, FileText, Terminal, Cpu, Layers, Edit3, Save, Link as LinkIcon, ExternalLink } from 'lucide-react';

// --- Utility: Simple Markdown Renderer ---
const RetroMarkdown = ({ content }) => {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <div className="font-mono text-sm leading-relaxed text-cyan-100 space-y-2 selection:bg-pink-500 selection:text-white">
      {lines.map((line, idx) => {
        if (line.startsWith('# ')) return <h1 key={idx} className="text-2xl font-bold text-pink-500 border-b border-pink-500/50 pb-1 mt-4 shadow-[0_0_10px_rgba(236,72,153,0.3)]">{line.replace('# ', '')}</h1>;
        if (line.startsWith('## ')) return <h2 key={idx} className="text-xl font-bold text-cyan-400 mt-3">{line.replace('## ', '')}</h2>;
        if (line.startsWith('- ')) return <li key={idx} className="ml-4 text-emerald-400 list-disc marker:text-emerald-500">{line.replace('- ', '')}</li>;
        if (line.startsWith('> ')) return <blockquote key={idx} className="border-l-4 border-amber-500 pl-3 italic text-amber-200 bg-amber-900/20 py-1">{line.replace('> ', '')}</blockquote>;
        if (line.startsWith('```')) return <div key={idx} className="bg-gray-900 border border-gray-700 p-2 my-2 text-xs text-green-400 font-mono whitespace-pre-wrap shadow-inner">Code Block</div>;
        if (line.trim() === '') return <br key={idx} />;
        return <p key={idx} className="opacity-90 break-words">{line}</p>;
      })}
    </div>
  );
};

// --- Components ---

const WindowHeader = ({ title, icon: Icon, colorClass, onClose, onEdit, isEditing }) => (
  <div className={`flex items-center justify-between px-3 py-2 ${colorClass} bg-opacity-20 border-b border-current backdrop-blur-sm cursor-grab active:cursor-grabbing select-none group relative z-20`}>
    <div className="flex items-center gap-2 overflow-hidden">
      <Icon size={16} className="animate-pulse flex-shrink-0" />
      <span className="font-mono text-xs font-bold uppercase tracking-widest truncate">{title}</span>
    </div>
    <div className="flex items-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity pl-2">
      {onEdit && (
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }} 
          className={`hover:text-white transition-colors ${isEditing ? 'text-white animate-pulse' : ''}`}
          title={isEditing ? "Save Mode" : "Edit Mode"}
        >
          {isEditing ? <Save size={14} /> : <Edit3 size={14} />}
        </button>
      )}
      <div className="flex gap-1 opacity-50">
         <div className="w-2 h-2 rounded-full bg-current" />
         <div className="w-2 h-2 rounded-full bg-current" />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onClose?.(); }} className="hover:text-white transition-colors">
        <X size={14} />
      </button>
    </div>
  </div>
);

const GitHubCard = ({ data }) => {
  // Logic simplified: Data is now guaranteed to be clean URLs or simple strings
  const getRepoName = (str) => {
    if (!str) return 'Unknown Repo';
    if (str.includes('[github.com/](https://github.com/)')) {
      return str.split('[github.com/](https://github.com/)')[1];
    }
    return str;
  };

  const repoName = getRepoName(data.repo);
  const repoUrl = data.url && data.url.startsWith('http') ? data.url : `https://github.com/${repoName}`;

  return (
    <div className="p-4 bg-black/80 h-full flex flex-col text-cyan-50 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
        <Github size={80} />
      </div>
      <div className="flex flex-col z-10">
        <div className="flex justify-between items-start mb-2">
           <a 
            href={repoUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-lg font-bold text-cyan-400 hover:text-pink-400 hover:underline cursor-pointer flex items-center gap-2 break-all relative z-50"
            onPointerDown={(e) => e.stopPropagation()} // Allow clicking link without dragging
           >
             {repoName}
             <ExternalLink size={14} />
           </a>
        </div>
        <span className="self-start text-[10px] border border-cyan-500/50 px-2 py-0.5 rounded-full text-cyan-300 mb-2">
          {data.language || 'Code'}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-2 mb-4 font-mono leading-relaxed flex-grow">
        {data.description || 'No description provided.'}
      </p>
      <div className="flex items-center gap-4 text-xs font-mono text-pink-400 z-10 mt-auto">
        <span className="flex items-center gap-1"><Cpu size={12}/> {data.stars || 0} Stars</span>
        <span className="flex items-center gap-1"><Layers size={12}/> {data.forks || 0} Forks</span>
      </div>
      
      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,3px_100%]" />
    </div>
  );
};

const WebFrame = ({ url, isDragging }) => (
  <div className="w-full h-full bg-gray-900 relative flex flex-col">
    {/* Address Bar Mock */}
    <div className="bg-gray-800 px-2 py-1 flex items-center gap-2 border-b border-gray-700">
        <div className="w-2 h-2 rounded-full bg-red-500/50" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
        <div className="w-2 h-2 rounded-full bg-green-500/50" />
        <div className="flex-1 bg-black/50 rounded px-2 py-0.5 text-[10px] text-emerald-500 font-mono truncate opacity-70">
            {url}
        </div>
    </div>
    <div className="flex-grow relative bg-white">
        {isDragging && <div className="absolute inset-0 z-50 bg-transparent" />}
        <iframe 
          src={url} 
          title="Web Content" 
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
    </div>
  </div>
);

const ArticleEditor = ({ content, onChange, isEditing }) => {
    // Intelligent wheel handling
    const handleWheel = (e) => {
        // If zooming (Ctrl/Meta + Wheel), allow event to bubble to canvas
        if (e.ctrlKey || e.metaKey) return;

        // If simple scrolling, stop propagation to prevent canvas pan
        // This keeps the text scroll smooth without moving the whole world
        e.stopPropagation();
    };

    if (isEditing) {
        return (
            <textarea 
                className="w-full h-full bg-gray-950 text-emerald-400 font-mono text-sm p-4 outline-none resize-none border-none focus:ring-1 focus:ring-emerald-500/50 z-30 relative"
                value={content}
                onChange={(e) => onChange(e.target.value)}
                onWheel={handleWheel}
                spellCheck="false"
                onPointerDown={(e) => e.stopPropagation()} // Ensure focus works and doesn't drag
            />
        );
    }
    return (
        <div 
            className="p-5 h-full overflow-y-auto bg-gray-950 text-gray-100 scrollbar-thin scrollbar-thumb-pink-600 scrollbar-track-gray-900 cursor-text z-30 relative"
            onWheel={handleWheel}
            onPointerDown={(e) => e.stopPropagation()} // Allow text selection without dragging window
        >
            <RetroMarkdown content={content} />
        </div>
    );
};

// --- Main Item Wrapper ---

const CanvasItem = ({ item, scale, onUpdate, onFocus, isSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    e.stopPropagation(); 
    onFocus(item.id);
    
    // Only drag if clicking Header or non-interactive parts
    // We check if the click target is strictly part of the container UI, not inner content
    const isInteractive = ['INPUT', 'TEXTAREA', 'A', 'BUTTON', 'IFRAME'].includes(e.target.tagName);
    
    // Also, if we are in Article Viewer mode (not editing), the ArticleEditor component
    // explicitly stops propagation on pointerDown to allow text selection.
    // So if we reach here, it's safe to drag?
    // Actually, checking styles/classes is safer.
    
    if (!isEditing && !isInteractive) {
        setIsDragging(true);
        startPos.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = (e.clientX - startPos.current.x) / scale;
    const dy = (e.clientY - startPos.current.y) / scale;
    
    onUpdate(item.id, {
      x: item.x + dx,
      y: item.y + dy
    });
    
    startPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    if(e.currentTarget.hasPointerCapture(e.pointerId)){
        e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const toggleEdit = () => {
      setIsEditing(!isEditing);
  };

  const getStyles = () => {
    switch(item.type) {
      case 'github': return {
        border: 'border-cyan-500', headerBg: 'bg-cyan-500', text: 'text-cyan-500',
        shadow: isSelected ? 'shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'shadow-[0_0_10px_rgba(6,182,212,0.1)]'
      };
      case 'article': return {
        border: 'border-pink-500', headerBg: 'bg-pink-500', text: 'text-pink-500',
        shadow: isSelected ? 'shadow-[0_0_30px_rgba(236,72,153,0.4)]' : 'shadow-[0_0_10px_rgba(236,72,153,0.1)]'
      };
      case 'web': return {
        border: 'border-emerald-500', headerBg: 'bg-emerald-500', text: 'text-emerald-500',
        shadow: isSelected ? 'shadow-[0_0_30px_rgba(16,185,129,0.4)]' : 'shadow-[0_0_10px_rgba(16,185,129,0.1)]'
      };
      default: return { border: 'border-gray-500', headerBg: 'bg-gray-500', text: 'text-gray-500', shadow: '' };
    }
  };

  const styles = getStyles();

  return (
    <div
      style={{
        transform: `translate(${item.x}px, ${item.y}px)`,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
      }}
      className={`absolute flex flex-col bg-gray-900 border ${styles.border} ${styles.shadow} transition-shadow duration-300`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <WindowHeader 
        title={item.title} 
        icon={item.icon} 
        colorClass={`${styles.headerBg} ${styles.text}`}
        onClose={() => onUpdate(item.id, { visible: false })}
        onEdit={item.type === 'article' ? toggleEdit : null}
        isEditing={isEditing}
      />
      <div className="flex-grow overflow-hidden relative">
        {item.type === 'github' && <GitHubCard data={item.content} />}
        {item.type === 'article' && (
            <ArticleEditor 
                content={item.content} 
                isEditing={isEditing} 
                onChange={(newContent) => onUpdate(item.id, { content: newContent })} 
            />
        )}
        {item.type === 'web' && <WebFrame url={item.content} isDragging={isDragging} />}
        
        {/* CRT Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_4px,3px_100%]" />
      </div>
      
      {/* Resize handle visual */}
      <div className={`absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize ${styles.headerBg} opacity-50 rounded-tl-lg pointer-events-none`} />
    </div>
  );
};

// --- Input Modal ---
const InputModal = ({ type, onClose, onSubmit }) => {
    const [value, setValue] = useState('');
    const [title, setTitle] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(value, title);
        onClose();
    };

    const config = {
        web: { title: 'OPEN_PORTAL', label: 'TARGET_URL', placeholder: '[https://example.com](https://example.com)', icon: Globe, color: 'text-emerald-500', border: 'border-emerald-500' },
        github: { title: 'CLONE_REPO', label: 'REPO_PATH', placeholder: 'Owner/RepoName', icon: Github, color: 'text-cyan-500', border: 'border-cyan-500' }
    }[type];

    if (!config) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className={`bg-black border ${config.border} p-6 w-96 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative`}>
                <div className={`flex items-center gap-2 mb-6 ${config.color}`}>
                    <config.icon className="animate-pulse" />
                    <h2 className="text-xl font-bold font-mono">{config.title}</h2>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono text-gray-500 mb-1">TITLE_TAG (Optional)</label>
                        <input 
                            autoFocus
                            type="text" 
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 p-2 text-white font-mono text-sm focus:border-white outline-none"
                            placeholder="My New Item"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-gray-500 mb-1">{config.label}</label>
                        <input 
                            type="text" 
                            required
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 p-2 text-white font-mono text-sm focus:border-white outline-none"
                            placeholder={config.placeholder}
                        />
                    </div>
                    
                    <div className="flex gap-2 mt-6">
                        <button type="button" onClick={onClose} className="flex-1 py-2 text-xs font-mono border border-gray-600 hover:bg-gray-800 text-gray-400">ABORT</button>
                        <button type="submit" className={`flex-1 py-2 text-xs font-mono font-bold bg-opacity-20 hover:bg-opacity-40 border ${config.border} ${config.color} uppercase`}>INITIALIZE</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Main App ---

const App = () => {
  const [canvas, setCanvas] = useState({ x: 0, y: 0, scale: 1 });
  const [modalType, setModalType] = useState(null); // 'web' | 'github'
  
  // Clean Data Initialization (No Markdown Links!)
  const [items, setItems] = useState([
    {
      id: 1,
      type: 'article',
      title: 'WELCOME_LOG.md',
      icon: Terminal,
      x: 100,
      y: 100,
      width: 400,
      height: 500,
      zIndex: 1,
      content: `# Digital Soul Interface

> "The sky above the port was the color of television, tuned to a dead channel."

## About Me
I am a creative developer floating in the digital void. This space is my garden, my workshop, and my museum.

## Instructions
- **EDIT**: Click the pencil icon on this window to edit text.
- **ADD**: Use the dock below to add Repos, Webs, or Docs.
- **NAV**: Drag to pan, Ctrl+Scroll to zoom.`
    },
    {
      id: 2,
      type: 'github',
      title: 'SimpleLLMFunc',
      icon: Github,
      x: 550,
      y: 100,
      width: 350,
      height: 220,
      zIndex: 2,
      content: {
        repo: 'NiJingzhe/SimpleLLMFunc',
        url: '[https://github.com/NiJingzhe/SimpleLLMFunc](https://github.com/NiJingzhe/SimpleLLMFunc)',
        language: 'Python',
        stars: 42,
        forks: 5,
        description: 'A simple and efficient LLM function calling library designed for easier integration.'
      }
    },
    {
      id: 3,
      type: 'github',
      title: 'Simple2DGameEngine',
      icon: Github,
      x: 550,
      y: 350,
      width: 350,
      height: 220,
      zIndex: 2,
      content: {
        repo: 'NiJingzhe/Simple2DGameEngine_Base_on_LibGraphic',
        url: '[https://github.com/NiJingzhe/Simple2DGameEngine_Base_on_LibGraphic](https://github.com/NiJingzhe/Simple2DGameEngine_Base_on_LibGraphic)',
        language: 'C++',
        stars: 28,
        forks: 3,
        description: 'A lightweight 2D game engine built from scratch based on LibGraphic.'
      }
    },
    {
      id: 4,
      type: 'web',
      title: 'SIMPLE_LLM_PORTAL',
      icon: Globe,
      x: 950,
      y: 100,
      width: 500,
      height: 600,
      zIndex: 4,
      content: 'https://simplellmfunc.cn'
    },
    {
      id: 5,
      type: 'github',
      title: 'SimpleManus',
      icon: Github,
      x: 550,
      y: 600,
      width: 350,
      height: 220,
      zIndex: 2,
      content: {
        repo: 'NiJingzhe/SimpleManus',
        url: '[https://github.com/NiJingzhe/SimpleManus](https://github.com/NiJingzhe/SimpleManus)',
        language: 'Python',
        stars: 15,
        forks: 1,
        description: 'An open source implementation for Manus AI agent concepts.'
      }
    }
  ]);

  // Canvas interaction logic
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = -0.001;
      const newScale = Math.min(Math.max(0.1, canvas.scale + e.deltaY * zoomSensitivity), 3);
      setCanvas(prev => ({ ...prev, scale: newScale }));
    } else {
      setCanvas(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const updateItem = (id, changes) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...changes } : item));
  };

  const bringToFront = (id) => {
    const maxZ = Math.max(...items.map(i => i.zIndex));
    updateItem(id, { zIndex: maxZ + 1 });
  };

  // Add Item Logic
  const addItem = (type, contentData, titleOverride) => {
      const id = Date.now();
      const centerX = -canvas.x + (window.innerWidth / 2) - 200; // Rough center logic
      const centerY = -canvas.y + (window.innerHeight / 2) - 200;
      
      const newItem = {
          id,
          type,
          x: centerX + Math.random() * 50,
          y: centerY + Math.random() * 50,
          zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1,
          width: type === 'web' ? 500 : 350,
          height: type === 'web' ? 400 : type === 'article' ? 400 : 220,
          title: titleOverride || (type === 'github' ? 'NEW_REPO' : type === 'web' ? 'NET_LINK' : 'NEW_DOC.md'),
          icon: type === 'github' ? Github : type === 'web' ? Globe : FileText,
          content: contentData
      };
      setItems(prev => [...prev, newItem]);
  };

  const handleModalSubmit = (value, title) => {
      if (modalType === 'web') {
          // Add protocol if missing
          let url = value;
          if (!url.startsWith('http')) url = 'https://' + url;
          addItem('web', url, title || 'NET_PORTAL');
      } else if (modalType === 'github') {
          addItem('github', {
              repo: value,
              url: value.startsWith('http') ? value : `https://github.com/${value}`,
              language: 'Unknown',
              stars: 0,
              forks: 0,
              description: 'User added repository.'
          }, title || value.split('/').pop() || 'GIT_REPO');
      }
  };

  return (
    <div 
      className="w-full h-screen overflow-hidden bg-black text-white font-mono relative select-none"
      onWheel={handleWheel}
    >
      {/* Infinite Grid */}
      <div 
        className="absolute inset-0 pointer-events-none transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${canvas.x}px, ${canvas.y}px) scale(${canvas.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <div className="absolute -top-[5000px] -left-[5000px] w-[10000px] h-[10000px] opacity-20"
          style={{ backgroundImage: 'linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)', backgroundSize: '100px 100px' }}
        />
        <div className="absolute -top-[5000px] -left-[5000px] w-[10000px] h-[10000px] opacity-10"
          style={{ backgroundImage: 'linear-gradient(to right, #0ff 1px, transparent 1px), linear-gradient(to bottom, #f0f 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
      </div>

      {/* Content */}
      <div 
        className="absolute inset-0 w-full h-full transform-gpu transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${canvas.x}px, ${canvas.y}px) scale(${canvas.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {items.filter(i => i.visible !== false).map(item => (
          <CanvasItem 
            key={item.id} 
            item={item} 
            scale={canvas.scale}
            onUpdate={updateItem}
            onFocus={bringToFront}
            isSelected={true}
          />
        ))}
      </div>

      {/* --- HUD & Controls --- */}
      
      {/* Input Modal */}
      {modalType && <InputModal type={modalType} onClose={() => setModalType(null)} onSubmit={handleModalSubmit} />}

      {/* Vignette & Noise */}
      <div className="fixed inset-0 pointer-events-none z-40 shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]" />
      <div 
        className="fixed inset-0 pointer-events-none z-40 opacity-[0.03] mix-blend-overlay bg-repeat" 
        style={{ 
          backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjkiIG51bU9jdGF2ZXM9IjQiLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIwLjA1Ii8+PC9zdmc+')` 
        }} 
      />
      
      {/* Header Info */}
      <div className="fixed top-6 left-6 z-50 flex flex-col gap-2">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">
          CYBER_SPACE <span className="text-xs align-top bg-cyan-600 text-black px-1">v3.3</span>
        </h1>
        <div className="flex gap-4 text-xs text-cyan-500/80 font-bold bg-black/50 p-2 border border-cyan-900 backdrop-blur-sm">
            <span>OBJ_COUNT: {items.filter(i => i.visible !== false).length}</span>
            <span>ZM: {(canvas.scale * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Dock */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="flex gap-4 p-3 bg-gray-900/90 backdrop-blur-md border border-gray-600 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          
          <button onClick={() => addItem('article', '# New Entry\n\nStart typing...', 'UNTITLED_LOG')} className="p-3 hover:bg-pink-600 hover:text-white rounded-xl transition-all text-pink-500 group relative bg-black/40">
            <FileText size={24} />
            <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-pink-600 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity rounded whitespace-nowrap">NEW TEXT</span>
          </button>
          
          <button onClick={() => setModalType('web')} className="p-3 hover:bg-emerald-600 hover:text-white rounded-xl transition-all text-emerald-500 group relative bg-black/40">
            <Globe size={24} />
            <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity rounded whitespace-nowrap">ADD WEB</span>
          </button>

          <button onClick={() => setModalType('github')} className="p-3 hover:bg-cyan-600 hover:text-white rounded-xl transition-all text-cyan-500 group relative bg-black/40">
            <Github size={24} />
            <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-cyan-600 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity rounded whitespace-nowrap">ADD REPO</span>
          </button>
          
          <div className="w-px bg-gray-700 mx-1" />
           
           <button 
             onClick={() => setCanvas({x:0, y:0, scale: 1})}
             className="p-3 hover:bg-white hover:text-black rounded-xl transition-all text-gray-400 group relative bg-black/40">
            <Move size={24} />
            <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity rounded whitespace-nowrap">RESET VIEW</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default App;