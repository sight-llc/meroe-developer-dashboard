import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-sm border border-paper-200 bg-white px-3 py-2 text-sm text-ink shadow-sm transition-colors',
        'placeholder:text-ink-600/40 focus-visible:outline-none focus-visible:border-vault-500 focus-visible:ring-1 focus-visible:ring-vault-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
