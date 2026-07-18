import { useState, useRef } from 'react'
import { BackupService } from '../services/BackupService'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { PageHeader } from '../components/ui/PageHeader'

export default function SettingsPage() {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    try {
      setIsExporting(true)
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
    } catch (err) {
      console.error('Export failed:', err)
      alert('Failed to export backup.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsImporting(true)
      setImportStatus(null)

      const text = await file.text()
      const validatedData = await BackupService.validateBackup(text)

      if (!window.confirm('This will completely replace all your current subjects, questions, and history with the backup data. Continue?')) {
        setIsImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      await BackupService.restoreBackup(validatedData)
      setImportStatus({ type: 'success', message: 'Backup restored successfully!' })

      // Clear the input
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Import failed:', err)
      setImportStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Invalid backup file.'
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleReset = async () => {
    try {
      setIsResetting(true)
      await BackupService.resetDatabase()
      setShowResetConfirm(false)
      alert('Database has been completely reset.')
      window.location.reload()
    } catch (err) {
      console.error('Reset failed:', err)
      alert('Failed to reset database.')
      setIsResetting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Settings"
        description="Protect and manage the study data stored locally in this browser."
      />

      <Alert variant="info" role="status">
        <div>
          <span className="font-semibold">Your data stays on this device.</span>{' '}
          Export a backup regularly if you want a portable copy or plan to clear browser storage.
        </div>
      </Alert>

      <Card className="divide-y divide-border-subtle">
        {/* Export Backup */}
        <div className="p-6 space-y-4 flex flex-col md:flex-row md:items-center md:justify-between md:space-y-0 gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-text-main">Export Backup</h2>
            <p className="text-sm text-text-muted">
              Download a complete JSON backup of all subjects, questions, and attempt history.
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            variant="secondary"
            className="shrink-0"
          >
            {isExporting ? 'Exporting...' : 'Download JSON Backup'}
          </Button>
        </div>

        {/* Restore Backup */}
        <div className="p-6 space-y-4 flex flex-col md:flex-row md:items-start md:justify-between md:space-y-0 gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-text-main">Restore Backup</h2>
            <p className="text-sm text-text-muted">
              Upload a valid backup file to replace all current data.
              <br className="hidden md:block"/>{' '}
              <strong className="text-danger-text font-medium">Warning:</strong> This will erase any current data not in the backup.
            </p>
            {importStatus && (
              <Alert variant={importStatus.type === 'success' ? 'success' : 'danger'} className="mt-4">
                {importStatus.message}
              </Alert>
            )}
          </div>
          <div className="shrink-0">
            <input
              type="file"
              accept=".json,application/json"
              ref={fileInputRef}
              onChange={handleImportFile}
              disabled={isImporting}
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              title="Select backup file"
            />
            <Button
              type="button"
              disabled={isImporting}
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
            >
              {isImporting ? 'Restoring...' : 'Select Backup File'}
            </Button>
          </div>
        </div>

      </Card>

      {/* Factory Reset */}
      <Card className="border-danger-border bg-danger-bg/20">
        <div className="p-6 space-y-4 flex flex-col md:flex-row md:items-center md:justify-between md:space-y-0 gap-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-danger-text">Danger Zone: Reset Database</h2>
            <p className="text-sm text-text-muted">
              Permanently delete all subjects, topics, questions, and attempt history. This action cannot be undone unless you have a backup.
            </p>
          </div>

          {showResetConfirm ? (
            <div className="w-full shrink-0 space-y-2 md:w-auto">
              <span className="block text-sm font-semibold text-danger-text">Are you sure?</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  variant="secondary"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReset}
                  disabled={isResetting}
                  variant="danger"
                  size="sm"
                >
                  {isResetting ? 'Resetting...' : 'Yes, Delete Everything'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowResetConfirm(true)}
              variant="outline"
              className="shrink-0 text-danger-text border-danger-border hover:bg-danger-bg hover:text-danger-text hover:border-danger-border"
            >
              Reset Database
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
