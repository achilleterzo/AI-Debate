import PayloadModalView from './PayloadModal'
import ConstraintModalView from './ConstraintModal'
import EndpointModalView from './EndpointModal'
import PromptSettingsModalView from './PromptSettingsModal'
import ConfirmModalView from './ConfirmModal'
import { modelSelectStyles } from './Style'

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
  promptSettingsModal,
  generalPersonalityInstructions,
  onClosePromptSettings,
  onSavePromptSettings,
  onResetPromptSettings,
  onClearSettings,
  confirmModal,
  onCancelConfirmModal,
  onConfirmModal,
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
        />
      )}
      {promptSettingsModal && (
        <PromptSettingsModalView
          value={generalPersonalityInstructions}
          onClose={onClosePromptSettings}
          onSave={onSavePromptSettings}
          onReset={onResetPromptSettings}
          onClearSettings={onClearSettings}
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
