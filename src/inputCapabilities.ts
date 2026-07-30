import { useEffect, useState } from 'react'

type InputEnvironment = Pick<Window, 'matchMedia'> & {
  navigator: Pick<Navigator, 'maxTouchPoints'>
}

export function hasTouchControls(environment: InputEnvironment): boolean {
  return (
    environment.navigator.maxTouchPoints > 0 ||
    environment.matchMedia('(any-pointer: coarse)').matches ||
    environment.matchMedia('(hover: none)').matches
  )
}

export function hasFinePointer(environment: Pick<Window, 'matchMedia'>): boolean {
  return environment.matchMedia('(any-pointer: fine)').matches
}

export function useTouchControls(): boolean {
  const detect = () => hasTouchControls(window)
  const [enabled, setEnabled] = useState(detect)

  useEffect(() => {
    const queries = [window.matchMedia('(any-pointer: coarse)'), window.matchMedia('(hover: none)')]
    const update = () => setEnabled(detect())

    queries.forEach((query) => query.addEventListener('change', update))
    window.addEventListener('resize', update)
    return () => {
      queries.forEach((query) => query.removeEventListener('change', update))
      window.removeEventListener('resize', update)
    }
  }, [])

  return enabled
}
