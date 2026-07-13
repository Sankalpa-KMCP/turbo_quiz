import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../SettingsPage'
import { BackupService } from '../../services/BackupService'

// Mock the service
vi.mock('../../services/BackupService', () => ({
  BackupService: {
    exportBackup: vi.fn(),
    validateBackup: vi.fn(),
    restoreBackup: vi.fn(),
    resetDatabase: vi.fn()
  }
}))

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
URL.createObjectURL = mockCreateObjectURL
URL.revokeObjectURL = mockRevokeObjectURL

// Mock window.confirm
const mockConfirm = vi.spyOn(window, 'confirm')

// Mock window.location.reload
const mockReload = vi.fn()
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true
})

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockReturnValue(true) // Default to true for confirm
  })

  it('renders the Settings layout', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /Settings/i })).toBeInTheDocument()
    expect(screen.getByText(/Export Backup/i)).toBeInTheDocument()
    expect(screen.getByText(/Restore Backup/i)).toBeInTheDocument()
    expect(screen.getByText(/Danger Zone: Reset Database/i)).toBeInTheDocument()
  })

  it('handles export backup successfully', async () => {
    vi.mocked(BackupService.exportBackup).mockResolvedValue('{"version":1}')
    mockCreateObjectURL.mockReturnValue('blob:mock-url')

    // Capture appended anchors
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const exportBtn = screen.getByRole('button', { name: /Download JSON Backup/i })
    fireEvent.click(exportBtn)

    expect(exportBtn).toHaveTextContent(/Exporting.../i)

    await waitFor(() => {
      expect(BackupService.exportBackup).toHaveBeenCalled()
    })

    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalled()
  })

  it('handles file import successfully', async () => {
    vi.mocked(BackupService.validateBackup).mockResolvedValue({ version: 1 } as unknown as import('../../schemas/backupSchema').BackupDataV1)
    vi.mocked(BackupService.restoreBackup).mockResolvedValue()

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    // The file input
    const fileInput = screen.getByTitle('Select backup file')
    const file = new File(['{"version":1}'], 'backup.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(BackupService.validateBackup).toHaveBeenCalledWith('{"version":1}')
      expect(mockConfirm).toHaveBeenCalled()
      expect(BackupService.restoreBackup).toHaveBeenCalledWith({ version: 1 })
      expect(screen.getByText(/Backup restored successfully!/i)).toBeInTheDocument()
    })
  })

  it('aborts import if confirm is cancelled', async () => {
    mockConfirm.mockReturnValue(false)
    vi.mocked(BackupService.validateBackup).mockResolvedValue({ version: 1 } as unknown as import('../../schemas/backupSchema').BackupDataV1)

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const fileInput = screen.getByTitle('Select backup file')
    const file = new File(['{"version":1}'], 'backup.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(BackupService.validateBackup).toHaveBeenCalled()
      expect(mockConfirm).toHaveBeenCalled()
      expect(BackupService.restoreBackup).not.toHaveBeenCalled()
    })
  })

  it('displays error if import validation fails', async () => {
    vi.mocked(BackupService.validateBackup).mockRejectedValue(new Error('Invalid JSON format'))

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const fileInput = screen.getByTitle('Select backup file')
    const file = new File(['bad'], 'backup.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(BackupService.validateBackup).toHaveBeenCalled()
      expect(screen.getByText(/Invalid JSON format/i)).toBeInTheDocument()
    })
  })

  it('handles database reset', async () => {
    vi.mocked(BackupService.resetDatabase).mockResolvedValue()
    // mock window alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    // Initial reset button
    const initResetBtn = screen.getByRole('button', { name: /Reset Database/i })
    fireEvent.click(initResetBtn)

    // Confirm UI appears
    expect(screen.getByText(/Are you sure\?/i)).toBeInTheDocument()

    // Confirm button
    const confirmBtn = screen.getByRole('button', { name: /Yes, Delete Everything/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(BackupService.resetDatabase).toHaveBeenCalled()
      expect(alertSpy).toHaveBeenCalledWith('Database has been completely reset.')
      expect(mockReload).toHaveBeenCalled()
    })
  })
})
