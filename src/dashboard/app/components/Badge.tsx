import type { ReactNode } from 'react'

export const Badge = ({ className = '', children }: { className?: string, children: ReactNode }) =>
  <span className={`badge ${className}`}>{children}</span>
