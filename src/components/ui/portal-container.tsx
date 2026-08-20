import * as React from "react"

const PortalContainerContext = React.createContext<HTMLElement | null>(null)

/**
 * Lets portalled popups (combobox, etc.) mount inside a modal layer so scroll
 * locking and pointer-events blocking don't disable them.
 */
function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null
  children: React.ReactNode
}) {
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  )
}

function usePortalContainer() {
  return React.useContext(PortalContainerContext)
}

export { PortalContainerProvider, usePortalContainer }
