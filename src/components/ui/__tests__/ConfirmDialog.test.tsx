import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../ConfirmDialog'

function Harness({
  tone = 'default' as 'default' | 'destructive',
  pending = false,
  disabled = false,
  closeOnEscape = true,
  closeOnBackdrop = true,
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
}: {
  tone?: 'default' | 'destructive'
  pending?: boolean
  disabled?: boolean
  closeOnEscape?: boolean
  closeOnBackdrop?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <ConfirmDialog
        open={open}
        title="Delete subject"
        description="This action cannot be undone."
        confirmLabel="Delete"
        tone={tone}
        pending={pending}
        disabled={disabled}
        closeOnEscape={closeOnEscape}
        closeOnBackdrop={closeOnBackdrop}
        onConfirm={() => {
          onConfirm()
        }}
        onCancel={() => {
          onCancel()
          setOpen(false)
        }}
      />
    </div>
  )
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exposes accessible name, description, and modal semantics', () => {
    render(
      <ConfirmDialog
        open
        title="Finish quiz"
        description="Submit your answers now."
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    )

    const dialog = screen.getByRole('dialog', { name: 'Finish quiz' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Submit your answers now.')
  })

  it('moves initial focus to the cancel action', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('contains Tab and Shift+Tab focus inside the dialog', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }))

    const dialog = screen.getByRole('dialog')
    const focusable = within(dialog).getAllByRole('button')
    const cancel = focusable.find((btn) => btn.textContent === 'Cancel')!
    const confirm = focusable.find((btn) => btn.textContent === 'Delete')!

    cancel.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()

    confirm.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(cancel).toHaveFocus()
  })

  it('cancels on Escape and restores focus to the trigger', () => {
    const onCancel = vi.fn()
    render(<Harness onCancel={onCancel} />)

    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('invokes cancel and confirm actions', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = render(<Harness onCancel={onCancel} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    rerender(<Harness onCancel={onCancel} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('uses danger styling for destructive tone', () => {
    render(
      <ConfirmDialog
        open
        title="Delete forever"
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    )

    const confirm = screen.getByRole('button', { name: 'Delete' })
    expect(confirm.className).toMatch(/bg-danger-base/)
  })

  it('blocks duplicate confirmation while pending or after first activation', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Reset data"
        confirmLabel="Reset"
        pending
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />
    )

    const confirm = screen.getByRole('button', { name: /Reset/i })
    expect(confirm).toBeDisabled()
    fireEvent.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('guards against repeated confirm clicks before pending flips', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Submit"
        confirmLabel="Submit"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />
    )

    const confirm = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables confirm when disabled without marking pending', () => {
    render(
      <ConfirmDialog
        open
        title="Locked"
        confirmLabel="Continue"
        disabled
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue' })).not.toHaveAttribute('aria-busy')
  })
})
