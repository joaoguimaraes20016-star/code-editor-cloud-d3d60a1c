import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { EditorProvider, EditorShell, useEditorStore } from '@/builder_v2';
import { extractDocument, type EditorDocument } from '@/builder_v2/state/persistence';
import { createPublishedSnapshot, type PublishedDocumentSnapshot } from '@/builder_v2/state/documentTypes';
import {
  deriveLegacyPayloadFromDocument,
  type LegacySnapshotPayload,
} from '@/builder_v2/legacy/legacyAdapter';
import { Button } from '@/components/ui/button';
import { useTeamRole } from '@/hooks/useTeamRole';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type BuilderFunnelRow = {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
  domain_id?: string | null;
  builder_document: EditorDocument | null;
  published_document_snapshot: PublishedDocumentSnapshot | null;
  updated_at: string;
};

type FunnelQueryResult = {
  funnel: BuilderFunnelRow;
  builderDocument: EditorDocument | null;
  legacyPayload: LegacySnapshotPayload | null;
  publishedSnapshot: PublishedDocumentSnapshot | null;
  hasLegacySteps: boolean;
};

function FullscreenMessage({ message }: { message: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

function BuilderEmptyState({
  teamId,
  funnelId,
  hasLegacySteps,
}: {
  teamId: string;
  funnelId: string;
  hasLegacySteps: boolean;
}) {
  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      // Fetch legacy steps to build initial document
      const { data: legacySteps } = await supabase
        .from('funnel_steps')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('order_index');

      // Create an initial empty document (migration can be enhanced later)
      const initialDoc: EditorDocument = {
        version: 1,
        pages: [
          {
            id: 'page-1',
            title: 'Home',
            nodes: [],
          },
        ],
        activePageId: 'page-1',
      };

      const { error } = await supabase
        .from('funnels')
        .update({ builder_document: initialDoc as unknown as Record<string, unknown> })
        .eq('id', funnelId);

      if (error) throw error;

      toast({ title: 'Builder V2 initialized', description: 'Reload the page to continue.' });
      window.location.reload();
    } catch (err) {
      console.error('[Builder] Migration failed', err);
      toast({ title: 'Migration failed', variant: 'destructive' });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <h1 className="text-xl font-semibold">Builder V2</h1>
      <p className="text-muted-foreground">
        {hasLegacySteps
          ? 'This funnel has legacy steps. Migrate to Builder V2 to continue.'
          : 'No builder document found. Initialize a new document to get started.'}
      </p>
      <Button onClick={handleMigrate} disabled={isMigrating}>
        {isMigrating ? 'Initializing…' : hasLegacySteps ? 'Migrate to V2' : 'Create Document'}
      </Button>
      <Button variant="ghost" asChild>
        <Link to={`/team/${teamId}/funnels`}>Back to Funnels</Link>
      </Button>
    </div>
  );
}

type BuilderCommandBarProps = {
  funnelId: string;
  teamId: string;
  funnelName: string;
  legacyPayload: LegacySnapshotPayload | null;
  onLegacyPayloadUpdate: (payload: LegacySnapshotPayload | null) => void;
  publishedSnapshot: PublishedDocumentSnapshot | null;
  onPublished: (snapshot: PublishedDocumentSnapshot) => void;
  lastSavedAt: Date | null;
  onSaved: (timestamp: Date) => void;
};

function BuilderCommandBar({
  funnelId,
  teamId,
  funnelName,
  legacyPayload,
  onLegacyPayloadUpdate,
  publishedSnapshot,
  onPublished,
  lastSavedAt,
  onSaved,
}: BuilderCommandBarProps) {
  const { pages, activePageId } = useEditorStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const runtimeStatus = useMemo(() => {
    if (!publishedSnapshot) {
      return 'Draft';
    }
    return `Published • ${new Date(publishedSnapshot.publishedAt).toLocaleString()}`;
  }, [publishedSnapshot]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const doc = extractDocument(pages, activePageId);
      const { error } = await supabase
        .from('funnels')
        .update({ builder_document: doc as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
        .eq('id', funnelId);

      if (error) {
        throw error;
      }
      const timestamp = new Date();
      onSaved(timestamp);
      toast({ title: 'Draft saved' });
    } catch (error) {
      console.error('[Builder] Save failed', error);
      toast({ title: 'Save failed', description: 'Unable to persist builder document', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const doc = extractDocument(pages, activePageId);
      const docLegacy = deriveLegacyPayloadFromDocument(doc) ?? legacyPayload;

      if (!docLegacy) {
        throw new Error('Add a legacy funnel block before publishing.');
      }

      const snapshot = createPublishedSnapshot(doc.pages, doc.activePageId, { legacy: docLegacy });

      const { error } = await supabase
        .from('funnels')
        .update({
          builder_document: doc as unknown as Record<string, unknown>,
          published_document_snapshot: snapshot as unknown as Record<string, unknown>,
          status: 'published',
          updated_at: new Date().toISOString(),
        })
        .eq('id', funnelId);

      if (error) {
        throw error;
      }

      const timestamp = new Date();
      onSaved(timestamp);
      toast({ title: 'Published', description: 'Runtime snapshot updated successfully.' });
      onLegacyPayloadUpdate(docLegacy);
      onPublished(snapshot);
    } catch (error) {
      console.error('[Builder] Publish failed', error);
      toast({ title: 'Publish failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-5 py-3">
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-semibold">{funnelName}</span>
        <span className="text-xs text-muted-foreground">{runtimeStatus}</span>
        {lastSavedAt && (
          <span className="text-xs text-muted-foreground">Draft saved {lastSavedAt.toLocaleTimeString()}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/team/${teamId}/funnels/${funnelId}/legacy`}>Legacy view</Link>
        </Button>
        <Button onClick={handleSave} size="sm" disabled={isSaving || isPublishing}>
          {isSaving ? 'Saving…' : 'Save Draft'}
        </Button>
        <Button onClick={handlePublish} size="sm" disabled={isPublishing || isSaving}>
          {isPublishing ? 'Publishing…' : 'Publish'}
        </Button>
      </div>
    </header>
  );
}

export default function FunnelEditor() {
  const { teamId, funnelId } = useParams<{ teamId: string; funnelId: string }>();
  const { isLoading: isRoleLoading } = useTeamRole(teamId);

  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [legacyPayload, setLegacyPayload] = useState<LegacySnapshotPayload | null>(null);
  const [publishedSnapshot, setPublishedSnapshot] = useState<PublishedDocumentSnapshot | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const funnelQuery = useQuery<FunnelQueryResult>({
    queryKey: ['funnel-builder', funnelId],
    enabled: !!funnelId && !isRoleLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnels')
        .select('id, team_id, name, slug, status, settings, domain_id, builder_document, published_document_snapshot, updated_at')
        .eq('id', funnelId!)
        .single();

      if (error) throw error;

      // Check if there are legacy steps
      const { count } = await supabase
        .from('funnel_steps')
        .select('id', { count: 'exact', head: true })
        .eq('funnel_id', funnelId!);

      const funnel = data as unknown as BuilderFunnelRow;
      const builderDocument = funnel.builder_document ?? null;
      const publishedSnap = funnel.published_document_snapshot ?? null;

      // Derive legacy payload from document if available
      let legacy: LegacySnapshotPayload | null = null;
      if (builderDocument) {
        legacy = deriveLegacyPayloadFromDocument(builderDocument);
      }

      return {
        funnel,
        builderDocument,
        legacyPayload: legacy,
        publishedSnapshot: publishedSnap,
        hasLegacySteps: (count ?? 0) > 0,
      };
    },
  });

  // Initialize editor state when document loads
  useEffect(() => {
    if (funnelQuery.data?.builderDocument) {
      setEditorKey(`editor-${funnelId}-${Date.now()}`);
      setLegacyPayload(funnelQuery.data.legacyPayload);
      setPublishedSnapshot(funnelQuery.data.publishedSnapshot);
    }
  }, [funnelId, funnelQuery.data]);

  if (!teamId || !funnelId) {
    return <FullscreenMessage message="Invalid route parameters" />;
  }

  if (isRoleLoading || funnelQuery.isLoading) {
    return <FullscreenMessage message="Loading funnel…" />;
  }

  if (funnelQuery.isError) {
    return <FullscreenMessage message="Failed to load funnel" />;
  }

  if (!funnelQuery.data) {
    return <FullscreenMessage message="Funnel not found" />;
  }

  if (!funnelQuery.data.builderDocument) {
    return (
      <BuilderEmptyState teamId={teamId} funnelId={funnelId} hasLegacySteps={funnelQuery.data.hasLegacySteps} />
    );
  }

  if (!editorKey) {
    return <FullscreenMessage message="Preparing Builder V2…" />;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <EditorProvider key={editorKey}>
        <BuilderCommandBar
          funnelId={funnelId}
          teamId={teamId}
          funnelName={funnelQuery.data.funnel.name}
          legacyPayload={legacyPayload}
          onLegacyPayloadUpdate={setLegacyPayload}
          publishedSnapshot={publishedSnapshot}
          onPublished={setPublishedSnapshot}
          lastSavedAt={lastSavedAt}
          onSaved={(timestamp) => setLastSavedAt(timestamp)}
        />
        <div className="flex-1 overflow-hidden">
          <EditorShell />
        </div>
      </EditorProvider>
    </div>
  );
}
