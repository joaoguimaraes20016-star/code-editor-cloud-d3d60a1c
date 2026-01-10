import React, { useCallback } from 'react';
import { EditorShell, createSamplePage, Page, SelectionState } from '../builder';

const Index: React.FC = () => {
  // Initialize with sample page data
  const [pageState] = React.useState<Page>(() => createSamplePage());

  // Handle state changes - in real app, this would sync with parent app's state
  const handleChange = useCallback((updatedState: Page) => {
    console.log('[InfoStack] State updated:', updatedState);
    // Parent app would handle persistence here
  }, []);

  // Handle selection changes
  const handleSelect = useCallback((selection: SelectionState) => {
    console.log('[InfoStack] Selection:', selection);
  }, []);

  // Handle publish
  const handlePublish = useCallback((page: Page) => {
    console.log('[InfoStack] Publish requested:', page);
    // Parent app would handle publishing
    alert('Publish callback triggered! Check console for page data.');
  }, []);

  return (
    <EditorShell
      initialState={pageState}
      onChange={handleChange}
      onSelect={handleSelect}
      onPublish={handlePublish}
    />
  );
};

export default Index;
