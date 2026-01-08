/**
 * PagesList - Perspective-style simple numbered page list
 * Clean, minimal, shows page numbers with names
 */

import { Plus, MoreHorizontal, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Page } from '../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PagesListProps {
  pages: Page[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
  onRenamePage?: (id: string, name: string) => void;
}

export function PagesList({ 
  pages, 
  activePageId, 
  onSelectPage, 
  onAddPage, 
  onDeletePage,
  onRenamePage 
}: PagesListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Pages</h3>
        <button
          onClick={onAddPage}
          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Add page"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Pages list */}
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-0.5">
          {pages.map((page, index) => (
            <div
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              className={cn(
                "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all",
                page.id === activePageId
                  ? "bg-slate-100"
                  : "hover:bg-slate-50"
              )}
            >
              {/* Drag handle - subtle */}
              <div className="opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
                <GripVertical size={12} className="text-slate-400" />
              </div>
              
              {/* Page number */}
              <span className={cn(
                "text-xs font-medium min-w-[20px]",
                page.id === activePageId ? "text-slate-600" : "text-slate-400"
              )}>
                {index + 1}
              </span>
              
              {/* Page name */}
              <span className={cn(
                "flex-1 text-sm truncate",
                page.id === activePageId ? "font-medium text-slate-900" : "text-slate-600"
              )}>
                {page.name}
              </span>

              {/* Actions menu */}
              {pages.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(page.id);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 size={14} className="mr-2" />
                      Delete page
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
