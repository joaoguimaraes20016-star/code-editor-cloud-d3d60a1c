/**
 * Phase 13: Document Switcher Component
 *
 * A minimal UI for switching between documents in the multi-document system.
 * Provides:
 * - List of all documents
 * - Active document indicator
 * - Create / Duplicate / Delete actions
 * - Inline rename
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';

import { useMultiDocumentStore } from '../state/multiDocStore';

export function DocumentSwitcher() {
  const {
    documentList,
    activeDocumentId,
    createDocument,
    deleteDocument,
    duplicateDocument,
    setActiveDocument,
    renameDocument,
  } = useMultiDocumentStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (docId: string, currentName: string) => {
    setEditingId(docId);
    setEditValue(currentName);
  };

  const handleFinishRename = () => {
    if (editingId && editValue.trim()) {
      renameDocument(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleFinishRename();
    } else if (event.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  };

  const handleDelete = (docId: string) => {
    if (documentList.length <= 1) {
      alert('Cannot delete the last document.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteDocument(docId);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Documents</span>
        <button
          type="button"
          onClick={() => createDocument()}
          style={styles.createButton}
          title="Create new document"
        >
          + New
        </button>
      </div>
      
      <div style={styles.list}>
        {documentList.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          const isEditing = editingId === doc.id;

          return (
            <div
              key={doc.id}
              style={{
                ...styles.item,
                ...(isActive ? styles.itemActive : {}),
              }}
            >
              <div
                style={styles.itemMain}
                onClick={() => !isEditing && setActiveDocument(doc.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isEditing) {
                    setActiveDocument(doc.id);
                  }
                }}
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleKeyDown}
                    style={styles.renameInput}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span style={styles.itemName}>{doc.name}</span>
                    {isActive && <span style={styles.activeIndicator}>●</span>}
                  </>
                )}
              </div>
              
              <div style={styles.itemActions}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(doc.id, doc.name);
                  }}
                  style={styles.actionButton}
                  title="Rename"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateDocument(doc.id);
                  }}
                  style={styles.actionButton}
                  title="Duplicate"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc.id);
                  }}
                  style={{
                    ...styles.actionButton,
                    ...(documentList.length <= 1 ? styles.actionButtonDisabled : {}),
                  }}
                  disabled={documentList.length <= 1}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={styles.footer}>
        <span style={styles.footerText}>
          {documentList.length} document{documentList.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    marginBottom: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  createButton: {
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 500,
    background: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    borderRadius: '4px',
    color: 'rgba(165, 180, 252, 1)',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  list: {
    maxHeight: '200px',
    overflowY: 'auto',
    padding: '4px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    marginBottom: '2px',
  },
  itemActive: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
  },
  itemMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.9)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  activeIndicator: {
    fontSize: '8px',
    color: 'rgba(99, 102, 241, 1)',
  },
  itemActions: {
    display: 'flex',
    gap: '4px',
    opacity: 0.6,
    transition: 'opacity 0.15s ease',
  },
  actionButton: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    color: 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.15s ease',
  },
  actionButtonDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  renameInput: {
    flex: 1,
    padding: '4px 8px',
    fontSize: '13px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(99, 102, 241, 0.5)',
    borderRadius: '4px',
    color: 'rgba(255, 255, 255, 0.95)',
    outline: 'none',
  },
  footer: {
    padding: '8px 12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  footerText: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
};
