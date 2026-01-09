import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { getNodeLabel } from '../utils/nodeLabels';
import { ElementActionMenu } from './ElementActionMenu';

interface ElementWrapperProps {
  nodeId: string;
  nodeType: string;
  isSelected: boolean;
  isHighlighted?: boolean;
  isReadonly?: boolean;
  depth?: number;
  canHaveChildren?: boolean;
  onSelect: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onMoveUp?: (nodeId: string) => void;
  onMoveDown?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: ReactNode;
}

export function ElementWrapper({
  nodeId,
  nodeType,
  isSelected,
  isHighlighted = false,
  isReadonly = false,
  depth = 0,
  canHaveChildren = false,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  canMoveUp = true,
  canMoveDown = true,
  children,
}: ElementWrapperProps) {
  const [isHovered, setIsHovered] = useState(false);
  const label = getNodeLabel(nodeType);

  // Show action menu when element is selected (not in editing mode)
  const showActionMenu = isSelected && !isReadonly;
  
  // Show hover tooltip when hovering and not selected
  const showHoverTooltip = isHovered && !isSelected && !isReadonly;

  return (
    <div
      className={cn(
        "element-wrapper",
        isSelected && "element-wrapper--selected",
        isHighlighted && "element-wrapper--highlighted",
        isReadonly && "element-wrapper--readonly",
        canHaveChildren ? "element-wrapper--container" : "element-wrapper--leaf"
      )}
      data-node-id={nodeId}
      data-node-type={label}
      data-selected={isSelected || undefined}
      data-highlighted={isHighlighted || undefined}
      data-depth={depth}
      onMouseEnter={() => !isReadonly && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (isReadonly) return;
        e.stopPropagation();
        onSelect(nodeId);
      }}
    >
      {/* Selection overlay */}
      <div className="element-wrapper-overlay" aria-hidden="true" />
      
      {/* Hover tooltip */}
      {showHoverTooltip && (
        <div className="element-wrapper-tooltip">
          Click to edit
        </div>
      )}
      
      {/* Selected label */}
      {isSelected && !isReadonly && (
        <div className="element-wrapper-label">
          {label}
        </div>
      )}
      
      {/* Action menu */}
      {showActionMenu && (
        <ElementActionMenu
          elementId={nodeId}
          onMoveUp={onMoveUp ? () => onMoveUp(nodeId) : undefined}
          onMoveDown={onMoveDown ? () => onMoveDown(nodeId) : undefined}
          onDuplicate={onDuplicate ? () => onDuplicate(nodeId) : undefined}
          onDelete={onDelete ? () => onDelete(nodeId) : undefined}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      )}
      
      {/* Content surface */}
      <div className="element-wrapper-surface">
        {children}
      </div>
    </div>
  );
}
