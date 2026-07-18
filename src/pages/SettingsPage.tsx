import { useRef, useState } from 'react'
import { BackupService } from '../services/BackupService'
import { type BackupDataV1 } from '../schemas/backupSchema'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PageHeader } from '../components/ui/PageHeader'

type Feedback = {
  type: 'success' | 'error'
  message: string
} | null

type ActiveDialog = 'restore' | 'reset' | null

export default function SettingsPage() {
  const [isExporting, setIsExporting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const [pendingBackup, setPendingBackup] = useState<BackupDataV1 | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectFileButtonRef = useRef<HTMLButtonElement>(null)
  const resetButtonRef = useRef<HTMLButtonElement>(null)

  const clearFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const closeRestoreDialog = () => {
    if (isRestoring) return
    setActiveDialog(null)
    setPendingBackup(null)
    setSelectedFileName(null)
    clearFileInput()
  }

  const closeResetDialog = () => {
    if (isResetting) return
    setActiveDialog(null)
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      setFeedback(null)
      const jsonStr = await BackupService.exportBackup()
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `turboquiz-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 100)

      setFeedback({
        type: 'success',
        message: 'Backup downloaded. Keep this file somewhere safe if you may clear browser storage.',
      })
    } catch (err) {
      console.error('Export failed:', err)
      setFeedback({
        type: 'error',
        message: 'Failed to export backup. Try again in a moment.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setFeedback(null)
      const text = await file.text()
      const validatedData = await BackupService.validateBackup(text)

      setPendingBackup(validatedData)
      setSelectedFileName(file.name)
      selectFileButtonRef.current?.focus()
      setActiveDialog('restore')
    } catch (err) {
      console.error('Import failed:', err)
      setPendingBackup(null)
      setSelectedFileName(null)
      clearFileInput()
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Invalid backup file.',
      })
    }
  }

  const handleConfirmRestore = async () => {
    if (!pendingBackup || isRestoring) return

    try {
      setIsRestoring(true)
      setFeedback(null)
      await BackupService.restoreBackup(pendingBackup)
      setActiveDialog(null)
      setPendingBackup(null)
      setSelectedFileName(null)
      clearFileInput()
      setFeedback({
        type: 'success',
        message: 'Backup restored successfully. Your previous local data was replaced.',
      })
    } catch (err) {
      console.error('Import failed:', err)
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to restore backup.',
      })
    } finally {
      setIsRestoring(false)
    }
  }

  const openResetDialog = () => {
    resetButtonRef.current?.focus()
    setActiveDialog('reset')
  }

  const handleConfirmReset = async () => {
    if (isResetting) return

    try {
      setIsResetting(true)
      setFeedback(null)
      await BackupService.resetDatabase()
      setFeedback({
        type: 'success',
        message: 'All local data was removed. Reloading…',
      })
      window.location.reload()
    } catch (err) {
      console.error('Reset failed:', err)
      setFeedback({
        type: 'error',
        message: 'Failed to reset database. Try again in a moment.',
      })
      setIsResetting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Settings"
        description="Protect and manage the study data stored locally in this browser."
      />

      <Alert variant="info" role="status">
        <div>
          <span className="font-semibold text-text-main">Your data stays on this device.</span>{' '}
          TurboQuiz does not sync to a cloud account. Export a backup if you want a portable copy
          or may clear browser storage.
        </div>
      </Alert>

      {feedback && activeDialog === null ? (
        <Alert
          variant={feedback.type === 'success' ? 'success' : 'danger'}
          role={feedback.type === 'success' ? 'status' : 'alert'}
        >
          {feedback.message}
        </Alert>
      ) : null}

      <section aria-labelledby="settings-export-heading" className="space-y-4 border-b border-border-subtle pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 id="settings-export-heading" className="text-base font-semibold text-text-main">
              Export backup
            </h2>
            <p className="text-sm leading-relaxed text-text-muted">
              Download a complete JSON copy of subjects, topics, questions, and attempt history.
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={isExporting || activeDialog !== null}
            variant="primary"
            className="w-full shrink-0 sm:w-auto"
          >
            {isExporting ? 'Exporting…' : 'Download JSON Backup'}
          </Button>
        </div>
      </section>

      <section aria-labelledby="settings-restore-heading" className="space-y-4 border-b border-border-subtle pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h2 id="settings-restore-heading" className="text-base font-semibold text-text-main">
              Restore backup
            </h2>
            <p id="restore-help" className="text-sm leading-relaxed text-text-muted">
              Choose a valid TurboQuiz backup file. Restoring replaces all current local data with
              the contents of that file.
            </p>
            {selectedFileName ? (
              <p className="text-sm text-text-main">
                <span className="font-medium">Selected file:</span>{' '}
                <span className="break-all">{selectedFileName}</span>
              </p>
            ) : null}
          </div>
          <div className="shrink-0">
            <input
              id="backup-restore-file"
              type="file"
              accept=".json,application/json"
              ref={fileInputRef}
              onChange={handleImportFile}
              disabled={isRestoring || activeDialog !== null}
              aria-label="Select backup file"
              aria-describedby="restore-help"
              className="sr-only"
              title="Select backup file"
            />
            <Button
              ref={selectFileButtonRef}
              type="button"
              disabled={isRestoring || activeDialog !== null}
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
            >
              Select Backup File
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="settings-privacy-heading" className="space-y-2 border-b border-border-subtle pb-8">
        <h2 id="settings-privacy-heading" className="text-base font-semibold text-text-main">
          Local privacy
        </h2>
        <p className="text-sm leading-relaxed text-text-muted">
          Study content and quiz history remain in this browser&apos;s storage. Clearing site data,
          switching browsers, or using another device will not carry that data unless you restore a
          backup you exported.
        </p>
      </section>

      <section aria-labelledby="settings-reset-heading" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 id="settings-reset-heading" className="text-base font-semibold text-danger-text">
              Reset database
            </h2>
            <p className="text-sm leading-relaxed text-text-muted">
              Permanently delete all locally stored subjects, topics, questions, attempts, and
              answers. This cannot be undone unless you have an exported backup.
            </p>
          </div>
          <Button
            ref={resetButtonRef}
            type="button"
            onClick={openResetDialog}
            disabled={activeDialog !== null || isResetting}
            variant="outline"
            className="w-full shrink-0 border-danger-border text-danger-text hover:bg-danger-bg hover:text-danger-text sm:w-auto"
          >
            Reset Database
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={activeDialog === 'restore'}
        title="Replace local data?"
        description={
          <>
            <p>
              Restoring will completely replace all subjects, topics, questions, and quiz history
              stored in this browser with the selected backup
              {selectedFileName ? (
                <>
                  {' '}
                  (<span className="break-all font-medium text-text-main">{selectedFileName}</span>)
                </>
              ) : null}
              .
            </p>
            <p className="mt-2 font-semibold text-danger-text">
              Any current data not present in the backup will be permanently removed.
            </p>
            {feedback?.type === 'error' && activeDialog === 'restore' ? (
              <p className="mt-2 text-danger-text">{feedback.message}</p>
            ) : null}
          </>
        }
        confirmLabel="Replace local data"
        cancelLabel="Cancel"
        tone="destructive"
        pending={isRestoring}
        closeOnEscape={!isRestoring}
        closeOnBackdrop={!isRestoring}
        onConfirm={handleConfirmRestore}
        onCancel={closeRestoreDialog}
      />

      <ConfirmDialog
        open={activeDialog === 'reset'}
        title="Delete all local data?"
        description={
          <>
            <p>
              This permanently removes every subject, topic, question, quiz attempt, and answer
              stored in this browser.
            </p>
            <p className="mt-2 font-semibold text-danger-text">
              This action cannot be undone unless you restore an exported backup afterward.
            </p>
            {feedback?.type === 'error' && activeDialog === 'reset' ? (
              <p className="mt-2 text-danger-text">{feedback.message}</p>
            ) : null}
          </>
        }
        confirmLabel="Delete all local data"
        cancelLabel="Cancel"
        tone="destructive"
        pending={isResetting}
        closeOnEscape={!isResetting}
        closeOnBackdrop={!isResetting}
        onConfirm={handleConfirmReset}
        onCancel={closeResetDialog}
      />
    </div>
  )
}
