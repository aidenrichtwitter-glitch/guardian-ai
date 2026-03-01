import React, { useState } from 'react';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';

interface DesktopWindowProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultWidth?: string;
  isActive?: boolean;
  onClose?: () => void;
  onFocus?: () => void;
  statusText?: string;
}

const DesktopWindow: React.FC<DesktopWindowProps> = ({
  title,
  icon,
  children,
  className = '',
  isActive = false,
  onFocus,
  statusText,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div
      className={`flex flex-col window-chrome rounded overflow-hidden transition-shadow duration-200 ${
        isActive ? 'border-glow ring-1 ring-primary/30' : ''
      } ${className}`}
      onClick={onFocus}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/50 border-b border-border select-none">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-primary text-xs">{icon}</span>}
          <span className="text-xs font-medium text-foreground/80 truncate">{title}</span>
          {statusText && (
            <span className="text-[10px] text-muted-foreground ml-2 hidden sm:inline">
              {statusText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-muted rounded-sm transition-colors">
            <Minus className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            className="p-1 hover:bg-muted rounded-sm transition-colors"
            onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }}
          >
            {isMaximized ? (
              <Minimize2 className="w-3 h-3 text-muted-foreground" />
            ) : (
              <Maximize2 className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
          <button className="p-1 hover:bg-destructive/20 rounded-sm transition-colors">
            <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export default DesktopWindow;
