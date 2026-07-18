import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../SettingsPage'
import { BackupService } from '../../services/BackupService'

vi.mock('../../services/BackupService', () => ({
  BackupService: {
    exportBackup: vi.fn(),
    validateBackup: vi.fn(),
    restoreBackup: vi.fn(),
    resetDatabase: vi.fn(),
  },
}))

const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
URL.createObjectURL = mockCreateObjectURL
URL.revokeObjectURL = mockRevokeObjectURL

const mockReload = vi.fn()
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
})

const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

async function selectBackupFile(contents = '{"version":1}', name = 'backup.json') {
  const fileInput = screen.getByLabelText(/Select backup file/i)
  const file = new File([contents], name, { type: 'application/json' })
  fireEvent.change(fileInput, { target: { files: [file] } })
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    alertSpy.mockClear()
    confirmSpy.mockClear()
  })

  it('renders Quiet Study Desk settings sections', () => {
    renderSettings()

    expect(screen.getByRole('heading', { name: /^Settings$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Export backup/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Restore backup/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Local privacy/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Reset database/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download JSON Backup/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Select Backup File/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reset Database/i })).toBeInTheDocument()
  })

  it('exports backup successfully with in-app feedback and without native alert', async () => {
    vi.mocked(BackupService.exportBackup).mockResolvedValue('{"version":1}')
    mockCreateObjectURL.mockReturnValue('blob:mock-url')

    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')

    renderSettings()

    const exportBtn = screen.getByRole('button', { name: /Download JSON Backup/i })
    fireEvent.click(exportBtn)

    expect(exportBtn).toHaveTextContent(/Exporting/i)

    await waitFor(() => {
      expect(BackupService.exportBackup).toHaveBeenCalled()
    })

    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()

    await waitFor(() => {
      expect(mockRevokeObjectURL).toHaveBeenCalled()
      expect(screen.getByText(/Backup downloaded/i)).toBeInTheDocument()
    })

    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('reports export failure through in-app alert without native dialogs', async () => {
    vi.mocked(BackupService.exportBackup).mockRejectedValue(new Error('disk full'))

    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /Download JSON Backup/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to export backup/i)
    })

    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('validates a selected file then opens restore confirmation', async () => {
    vi.mocked(BackupService.validateBackup).mockResolvedValue({
      version: 1,
    } as unknown as import('../../schemas/backupSchema').BackupDataV1)

    renderSettings()
    await selectBackupFile('{"version":1}', 'study-backup.json')

    await waitFor(() => {
      expect(BackupService.validateBackup).toHaveBeenCalledWith('{"version":1}')
      expect(screen.getByRole('dialog', { name: /Replace local data/i })).toBeInTheDocument()
      expect(screen.getAllByText(/study-backup\.json/i).length).toBeGreaterThan(0)
    })

    expect(BackupService.restoreBackup).not.toHaveBeenCalled()
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('cancels restore from the dialog without calling restore', async () => {
    vi.mocked(BackupService.validateBackup).mockResolvedValue({
      version: 1,
    } as unknown as import('../../schemas/backupSchema').BackupDataV1)

    renderSettings()
    const selectBtn = screen.getByRole('button', { name: /Select Backup File/i })
    selectBtn.focus()
    await selectBackupFile()

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    expect(BackupService.restoreBackup).not.toHaveBeenCalled()
    expect(selectBtn).toHaveFocus()
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('cancels restore with Escape and restores focus', async () => {
    vi.mocked(BackupService.validateBackup).mockResolvedValue({
      version: 1,
    } as unknown as import('../../schemas/backupSchema').BackupDataV1)

    renderSettings()
    const selectBtn = screen.getByRole('button', { name: /Select Backup File/i })
    selectBtn.focus()
    await selectBackupFile()

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    expect(BackupService.restoreBackup).not.toHaveBeenCalled()
    expect(selectBtn).toHaveFocus()
  })

  it('confirms restore, replaces data, and shows success feedback', async () => {
    vi.mocked(BackupService.validateBackup).mockResolvedValue({
      version: 1,
    } as unknown as import('../../schemas/backupSchema').BackupDataV1)
    vi.mocked(BackupService.restoreBackup).mockResolvedValue()

    renderSettings()
    await selectBackupFile()

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Replace local data/i }))

    await waitFor(() => {
      expect(BackupService.restoreBackup).toHaveBeenCalledWith({ version: 1 })
      expect(screen.getByText(/Backup restored successfully/i)).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    expect(alertSpy).not.toHaveBeenCalled()
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('keeps the restore dialog open and shows failure feedback when restore fails', async () => {
    vi.mocked(BackupService.validateBackup).mockResolvedValue({
      version: 1,
    } as unknown as import('../../schemas/backupSchema').BackupDataV1)
    vi.mocked(BackupService.restoreBackup).mockRejectedValue(new Error('Write failed'))

    renderSettings()
    await selectBackupFile()

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Replace local data/i }))

    await waitFor(() => {
      expect(BackupService.restoreBackup).toHaveBeenCalled()
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(/Write failed/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('disables duplicate restore confirmation while pending', async () => {
    let resolveRestore!: () => void
    vi.mocked(BackupService.validateBackup).mockResolvedValue({
      version: 1,
    } as unknown as import('../../schemas/backupSchema').BackupDataV1)
    vi.mocked(BackupService.restoreBackup).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRestore = () => resolve()
        }),
    )

    renderSettings()
    await selectBackupFile()

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const confirmBtn = screen.getByRole('button', { name: /Replace local data/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(confirmBtn).toBeDisabled()
      expect(confirmBtn).toHaveAttribute('aria-busy', 'true')
    })

    fireEvent.click(confirmBtn)
    expect(BackupService.restoreBackup).toHaveBeenCalledTimes(1)

    resolveRestore()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('displays validation errors without opening the restore dialog', async () => {
    vi.mocked(BackupService.validateBackup).mockRejectedValue(new Error('Invalid JSON format'))

    renderSettings()
    await selectBackupFile('bad')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid JSON format/i)
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(BackupService.restoreBackup).not.toHaveBeenCalled()
  })

  it('opens reset confirmation with Cancel as initial focus', async () => {
    renderSettings()
    const resetBtn = screen.getByRole('button', { name: /Reset Database/i })
    resetBtn.focus()
    fireEvent.click(resetBtn)

    const dialog = await screen.findByRole('dialog', { name: /Delete all local data/i })
    expect(within(dialog).getByRole('button', { name: /^Cancel$/i })).toHaveFocus()
  })

  it('cancels reset without calling resetDatabase', async () => {
    renderSettings()
    const resetBtn = screen.getByRole('button', { name: /Reset Database/i })
    resetBtn.focus()
    fireEvent.click(resetBtn)

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    expect(BackupService.resetDatabase).not.toHaveBeenCalled()
    expect(resetBtn).toHaveFocus()
  })

  it('confirms reset, clears data, and reloads without native dialogs', async () => {
    vi.mocked(BackupService.resetDatabase).mockResolvedValue()

    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /Reset Database/i }))

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /Delete all local data/i }))

    await waitFor(() => {
      expect(BackupService.resetDatabase).toHaveBeenCalled()
      expect(mockReload).toHaveBeenCalled()
    })

    expect(alertSpy).not.toHaveBeenCalled()
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('keeps the reset dialog open when reset fails', async () => {
    vi.mocked(BackupService.resetDatabase).mockRejectedValue(new Error('reset boom'))

    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /Reset Database/i }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /Delete all local data/i }))

    await waitFor(() => {
      expect(within(screen.getByRole('dialog')).getByText(/Failed to reset database/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(mockReload).not.toHaveBeenCalled()
  })

  it('allows only one destructive dialog at a time', async () => {
    vi.mocked(BackupService.validateBackup).mockResolvedValue({
      version: 1,
    } as unknown as import('../../schemas/backupSchema').BackupDataV1)

    renderSettings()
    await selectBackupFile()

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Replace local data/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Reset Database/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Download JSON Backup/i })).toBeDisabled()
  })
})
