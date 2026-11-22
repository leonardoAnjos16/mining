import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

type Open = { key: string, left: number, top: number, content: ReactNode }

const PopoverContext = createContext<(key: string, anchor: HTMLElement, content: ReactNode) => void>(() => {})

const POPOVER_WIDTH = 580

export const PopoverProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState<Open | null>(null)

  useEffect(() => {
    const close = () => setOpen(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const toggle = useCallback((key: string, anchor: HTMLElement, content: ReactNode) => {
    setOpen(current => {
      if (current?.key === key) return null
      const rect = anchor.getBoundingClientRect()
      return {
        key,
        content,
        left: Math.max(8, Math.min(rect.left, document.documentElement.clientWidth - POPOVER_WIDTH)) + window.scrollX,
        top: rect.bottom + window.scrollY + 4
      }
    })
  }, [])

  return (
    <PopoverContext.Provider value={toggle}>
      {children}
      {open && <div id="popover" style={{ left: open.left, top: open.top }} onClick={event => event.stopPropagation()}>{open.content}</div>}
    </PopoverContext.Provider>
  )
}

type PopoverButtonProps = {
  popoverKey: string
  title: string
  className?: string
  children: ReactNode
  content: () => ReactNode
}

export const PopoverButton = ({ popoverKey, title, className = 'help', children, content }: PopoverButtonProps) => {
  const toggle = useContext(PopoverContext)
  return (
    <button className={className} title={title} onClick={event => {
      event.stopPropagation()
      toggle(popoverKey, event.currentTarget, content())
    }}>{children}</button>
  )
}
