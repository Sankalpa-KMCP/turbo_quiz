import { cn } from '../../utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonStyleOptions {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const buttonStyles = ({ variant = 'primary', size = 'md' }: ButtonStyleOptions = {}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-[background-color,border-color,color,transform] focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer shadow-sm active:translate-y-px'

  const variants = {
    primary: 'bg-primary-base hover:bg-primary-hover text-text-inverse',
    secondary: 'bg-surface-overlay hover:bg-border-strong text-text-main border border-border-subtle',
    outline: 'bg-transparent border border-border-strong hover:bg-surface-overlay text-text-main',
    ghost: 'bg-transparent hover:bg-surface-overlay text-text-main shadow-none',
    danger: 'bg-danger-base hover:bg-danger-hover text-text-inverse'
  }

  const sizes = {
    sm: 'min-h-11 min-w-11 px-3 py-1.5 text-xs',
    md: 'min-h-11 px-4 py-2 text-sm',
    lg: 'min-h-12 px-5 py-2.5 text-base'
  }

  return cn(baseStyles, variants[variant], sizes[size])
}
