import React from 'react'
import { cn } from '../../lib/utils'

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
}

const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const variantClasses = {
      default: 'bg-gray-100 text-gray-800 border-gray-200',
      primary: 'bg-primary-100 text-primary-800 border-primary-200',
      secondary: 'bg-secondary-100 text-secondary-800 border-secondary-200',
      success: 'bg-green-100 text-green-800 border-green-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      error: 'bg-red-100 text-red-800 border-red-200'
    }
    
    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1 text-sm',
      lg: 'px-4 py-2 text-base'
    }
    
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center border rounded-full font-medium',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Chip.displayName = 'Chip'

export { Chip }