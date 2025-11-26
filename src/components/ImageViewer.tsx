interface ImageViewerProps {
  url: string;
}

export const ImageViewer = ({ url }: ImageViewerProps) => (
  <div className="w-full h-full bg-black/30 backdrop-blur-md flex items-center justify-center relative overflow-hidden group">
    <img 
      src={url} 
      alt="Display" 
      className="max-w-full max-h-full object-contain"
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-red-500 font-mono text-sm';
        errorDiv.textContent = 'IMAGE_LOAD_ERROR';
        target.parentElement?.appendChild(errorDiv);
      }}
    />
    {/* CRT Overlay */}
    <div className="absolute inset-0 pointer-events-none crt-overlay z-0" />
  </div>
);

