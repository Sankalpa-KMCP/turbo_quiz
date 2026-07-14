import { useState, useRef } from 'react'
import { BackupService } from '../services/BackupService'

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
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-slate-400 text-sm mt-1 max-w-2xl">
          Manage your local storage. Export full backups, restore from an existing backup, or completely reset your database.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">

        {/* Export Backup */}
        <div className="p-6 space-y-4 flex flex-col md:flex-row md:items-center md:justify-between md:space-y-0 gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-200">Export Backup</h2>
            <p className="text-sm text-slate-400">
              Download a complete JSON backup of all subjects, questions, and attempt history.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="shrink-0 inline-flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-sm transition-colors border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Download JSON Backup'}
          </button>
        </div>

        {/* Restore Backup */}
        <div className="p-6 space-y-4 flex flex-col md:flex-row md:items-start md:justify-between md:space-y-0 gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-200">Restore Backup</h2>
            <p className="text-sm text-slate-400">
              Upload a valid backup file to replace all current data.
              <br className="hidden md:block"/>
              <strong className="text-rose-400 font-medium">Warning:</strong> This will erase any current data not in the backup.
            </p>
            {importStatus && (
              <div className={`text-sm mt-2 font-medium ${importStatus.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {importStatus.message}
              </div>
            )}
          </div>
          <div className="shrink-0 relative">
            <input
              type="file"
              accept=".json,application/json"
              ref={fileInputRef}
              onChange={handleImportFile}
              disabled={isImporting}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              title="Select backup file"
            />
            <button
              type="button"
              disabled={isImporting}
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-semibold rounded-lg text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isImporting ? 'Restoring...' : 'Select Backup File'}
            </button>
          </div>
        </div>

        {/* Factory Reset */}
        <div className="p-6 space-y-4 flex flex-col md:flex-row md:items-center md:justify-between md:space-y-0 gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-rose-400">Danger Zone: Reset Database</h2>
            <p className="text-sm text-slate-400">
              Permanently delete all subjects, topics, questions, and attempt history. This action cannot be undone unless you have a backup.
            </p>
          </div>

          {showResetConfirm ? (
            <div className="shrink-0 flex items-center gap-3">
              <span className="text-sm font-bold text-rose-400">Are you sure?</span>
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-sm font-bold transition-colors shadow disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : 'Yes, Delete Everything'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="shrink-0 inline-flex items-center justify-center px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              Reset Database
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
