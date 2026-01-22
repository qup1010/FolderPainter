import { usePreviewSession } from "./hooks/usePreviewSession";
import { AppLayout } from "./AppLayout";
import "./App.css";
import "./animations.css";

function App() {
  const {
    session,
    isLoading,
    error,
    addFolders,
    removeFolder,
    generateVersion,
    deleteVersion,
    setCurrentVersion,
    applySingle,
    applyAll,
    saveChatHistory,
    clearError,
    getFolderByIndex,
    reloadSession,
  } = usePreviewSession();

  return (
    <AppLayout
      session={session}
      isLoading={isLoading}
      error={error}
      onAddFolders={addFolders}
      onRemoveFolder={removeFolder}
      onGenerateVersion={generateVersion}
      onDeleteVersion={deleteVersion}
      onSetCurrentVersion={setCurrentVersion}
      onApplySingle={applySingle}
      onApplyAll={applyAll}
      onSaveChatHistory={saveChatHistory}
      onClearError={clearError}
      getFolderByIndex={getFolderByIndex}
      onSessionUpdate={reloadSession}
    />
  );
}

export default App;
