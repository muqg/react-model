import {render} from "@testing-library/react"
import {StrictMode} from "react"

/**
 * Render a component in React `<StrictMode/>`.
 */
export const renderStrict = (((ui: any, options: any) => {
  return render(ui, {wrapper: StrictMode, ...options})
}) as any) as typeof render
