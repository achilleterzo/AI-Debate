import PayloadModalView from './PayloadModal'
import ConstraintModalView from './ConstraintModal'
import EndpointModalView from './EndpointModal'
import CustomLanguageModalView from './CustomLanguageModal'
import PromptSettingsModalView from './PromptSettingsModal'
import ConfirmModalView from './ConfirmModal'
import { modelSelectStyles, moodSelectStyles } from './Style'

export default function AppModals({
  payloadModal,
  onClosePayloadModal,
  constraintModal,
  onCloseConstraintModal,
  onConfirmConstraint,
  globalConstraintHistory,
  onDeleteGlobalSuggestion,
  endpointModal,
  onCloseEndpointModal,
  onConfirmEndpoint,
  customLangModal,
  onCloseCustomLangModal,
  onConfirmCustomLang,
  endpointHistory = [],
  onDeleteEndpointHistoryEntry,
  models = [],
  defaultModel,
  onDefaultModelChange,
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
  pageBlockKb,
  onPageBlockKbChange,
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
        />
      )}
      {endpointModal && (
        <EndpointModalView
          state={endpointModal}
          onClose={onCloseEndpointModal}
          onConfirm={onConfirmEndpoint}
          history={endpointHistory}
          onDeleteHistoryEntry={onDeleteEndpointHistoryEntry}
          models={models}
          defaultModel={defaultModel}
          onDefaultModelChange={onDefaultModelChange}
          connecting={connecting}
          connectError={connectError}
          ollamaOk={ollamaOk}
          disabled={running}
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
          pageBlockKb={pageBlockKb}
          onPageBlockKbChange={onPageBlockKbChange}
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
