import { useCallback, useEffect, useRef, useState } from 'react'
import type { UIEvent } from 'react'

type UseScrollingOptions = {
  delay?: number
}

type UseScrollingResult = {
  isScrolling: boolean
  handleScroll: (event: UIEvent<HTMLDivElement>) => void
}

export const useScrolling = ({ delay = 50 }: UseScrollingOptions): UseScrollingResult => {
  const [isScrolling, setIsScrolling] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      setIsScrolling(true)

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = window.setTimeout(() => {
        setIsScrolling(false)
        timeoutRef.current = null
      }, delay)
    },
    [delay],
  )

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    },
    [],
  )

  return { isScrolling, handleScroll }
}
