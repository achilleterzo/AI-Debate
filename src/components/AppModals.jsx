import PayloadModalView from './PayloadModal'
import ConstraintModalView from './ConstraintModal'
import CustomLanguageModalView from './CustomLanguageModal'
import PromptSettingsModalView from './PromptSettingsModal'
import ConfirmModalView from './ConfirmModal'
import ProviderSettingsDialog from './ProviderSettingsDialog'
import { modelSelectStyles, moodSelectStyles } from './Style'

export default function AppModals({
  payloadModal,
  onClosePayloadModal,
  constraintModal,
  onCloseConstraintModal,
  onConfirmConstraint,
  globalConstraintHistory,
  onDeleteGlobalSuggestion,
  wand = null,
  endpointModal,
  onCloseEndpointModal,
  customLangModal,
  onCloseCustomLangModal,
  onConfirmCustomLang,
  endpointHistory = [],
  onDeleteEndpointHistoryEntry,
  defaultModel,
  onDefaultModelChange,
  defaultThinkingLevel,
  onDefaultThinkingLevelChange,
  connecting,
  connectError,
  ollamaOk,
  promptSettingsModal,
  generalPersonalityInstructions,
  onClosePromptSettings,
  onSavePromptSettings,
  onResetPromptSettings,
  onClearSettings,
  interfaceLang,
  onInterfaceLangChange,
  confirmModal,
  onCancelConfirmModal,
  onConfirmModal,
  updateCheck,
  timeoutSec,
  onTimeoutSecChange,
  debugMode,
  onDebugModeChange,
  running,
  enabledTools,
  onEnabledToolsChange,
  searchApiKey,
  onSearchApiKeyChange,
  searchEngine,
  onSearchEngineChange,
  pageBlockKb,
  onPageBlockKbChange,
  debugPayloadTurns,
  onDebugPayloadTurnsChange,
  onRestoreNotices,
  endpointInput,
  onConnectEndpoint,
  availableModels = [],
  disabledModels = [],
  onToggleModelEnabled,
  onSetAllModelsEnabled,
  providerId,
  onProviderChange,
  onRefreshProvider,
  ollamaCloudHasSavedKey,
  onOllamaCloudConnect,
  scopedProviderSettings,
}) {
  return (
    <>
      {payloadModal && (
        <PayloadModalView
          payload={payloadModal.title
            ? (Object.prototype.hasOwnProperty.call(payloadModal, 'text') ? payloadModal.text : payloadModal.payload)
            : payloadModal}
          title={payloadModal.title}
          onClose={onClosePayloadModal}
        />
      )}
      {constraintModal && (
        <ConstraintModalView
          state={constraintModal}
          onClose={onCloseConstraintModal}
          onConfirm={onConfirmConstraint}
          globalSuggestions={globalConstraintHistory}
          selectStyles={modelSelectStyles}
          onDeleteGlobalSuggestion={onDeleteGlobalSuggestion}
          wand={wand}
        />
      )}
      {endpointModal?.target === 'main' && (
        <ProviderSettingsDialog
          onClose={onCloseEndpointModal}
          providerId={providerId}
          onProviderChange={onProviderChange}
          onRefreshProvider={onRefreshProvider}
          ollamaCloudHasSavedKey={ollamaCloudHasSavedKey}
          onOllamaCloudConnect={onOllamaCloudConnect}
          endpoint={endpointInput}
          onConnect={onConnectEndpoint}
          connecting={connecting}
          connectError={connectError}
          ollamaOk={ollamaOk}
          history={endpointHistory}
          onDeleteHistoryEntry={onDeleteEndpointHistoryEntry}
          models={availableModels}
          disabledModels={disabledModels}
          onToggleModel={onToggleModelEnabled}
          onSetAllModelsEnabled={onSetAllModelsEnabled}
          defaultModel={defaultModel}
          onDefaultModelChange={onDefaultModelChange}
          defaultThinkingLevel={defaultThinkingLevel}
          onDefaultThinkingLevelChange={onDefaultThinkingLevelChange}
          disabled={running}
        />
      )}
      {/* Everything that picks a model through a provider — a participant, the
          round summary — opens the same dialog, scoped to itself. */}
      {scopedProviderSettings && (
        <ProviderSettingsDialog
          onClose={onCloseEndpointModal}
          {...scopedProviderSettings}
        />
      )}
      {promptSettingsModal && (
        <PromptSettingsModalView
          value={generalPersonalityInstructions}
          onClose={onClosePromptSettings}
          onSave={onSavePromptSettings}
          onReset={onResetPromptSettings}
          onClearSettings={onClearSettings}
          interfaceLang={interfaceLang}
          onInterfaceLangChange={onInterfaceLangChange}
          moodSelectStyles={moodSelectStyles}
          updateCheck={updateCheck}
          timeoutSec={timeoutSec}
          onTimeoutSecChange={onTimeoutSecChange}
          debugMode={debugMode}
          onDebugModeChange={onDebugModeChange}
          running={running}
          enabledTools={enabledTools}
          onEnabledToolsChange={onEnabledToolsChange}
          searchApiKey={searchApiKey}
          onSearchApiKeyChange={onSearchApiKeyChange}
          searchEngine={searchEngine}
          onSearchEngineChange={onSearchEngineChange}
          pageBlockKb={pageBlockKb}
          onPageBlockKbChange={onPageBlockKbChange}
          debugPayloadTurns={debugPayloadTurns}
          onDebugPayloadTurnsChange={onDebugPayloadTurnsChange}
          onRestoreNotices={onRestoreNotices}
          endpoint={endpointInput}
          onConnectEndpoint={onConnectEndpoint}
          connecting={connecting}
          connectError={connectError}
          ollamaOk={ollamaOk}
          endpointHistory={endpointHistory}
          onDeleteEndpointHistoryEntry={onDeleteEndpointHistoryEntry}
          availableModels={availableModels}
          disabledModels={disabledModels}
          onToggleModelEnabled={onToggleModelEnabled}
          onSetAllModelsEnabled={onSetAllModelsEnabled}
          providerId={providerId}
          onProviderChange={onProviderChange}
          onRefreshProvider={onRefreshProvider}
          ollamaCloudHasSavedKey={ollamaCloudHasSavedKey}
          onOllamaCloudConnect={onOllamaCloudConnect}
          defaultModel={defaultModel}
          onDefaultModelChange={onDefaultModelChange}
        />
      )}
      {customLangModal && (
        <CustomLanguageModalView
          state={customLangModal}
          onClose={onCloseCustomLangModal}
          onConfirm={onConfirmCustomLang}
        />
      )}
      {confirmModal && (
        <ConfirmModalView
          state={confirmModal}
          onCancel={onCancelConfirmModal}
          onConfirm={onConfirmModal}
        />
      )}
    </>
  )
}
