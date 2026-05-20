'use client'

import { useEffect } from 'react'

// Singleton observer shared across all components — created once, never torn down
let _observer: IntersectionObserver | null = null

function getObserver(): IntersectionObserver {
  if (_observer) return _observer
  _observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('show')
          _observer?.unobserve(e.target)
        }
      })
    },
    { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
  )
  return _observer
}

export function useReveal() {
  useEffect(() => {
    const obs = getObserver()
    // Only observe elements that haven't been revealed yet
    document.querySelectorAll('.reveal:not(.show)').forEach((el) => obs.observe(el))
    // No cleanup — the singleton persists for the lifetime of the page
  }, [])
}
