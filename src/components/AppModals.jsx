import PayloadModalView from './PayloadModal'
import ConstraintModalView from './ConstraintModal'
import EndpointModalView from './EndpointModal'
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
  endpointHistory = [],
  onDeleteEndpointHistoryEntry,
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
  running,
}) {
  return (
    <>
      {payloadModal && <PayloadModalView payload={payloadModal} onClose={onClosePayloadModal} />}
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
          running={running}
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
