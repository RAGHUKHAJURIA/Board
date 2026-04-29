import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  isActive: boolean;
  onClick: () => void;
}

export function ToolButton({ icon: Icon, label, shortcut, isActive, onClick }: ToolButtonProps) {
  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger
          onClick={onClick}
          className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center
            ${isActive 
              ? 'bg-foreground text-background shadow-md scale-110' 
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-200 dark:bg-zinc-800'
            }
          `}
        >
          <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={10} className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center space-x-2">
            <span>{label}</span>
            {shortcut && (
              <span className="font-mono text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-1 rounded">{shortcut}</span>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
