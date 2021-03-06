import {renderHook} from "@testing-library/react-hooks"
import React, {PropsWithChildren} from "react"
import {ModelProvider} from "../ModelProvider"
import {useField} from "../useField"
import {render} from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const ContextProvider = jest.fn(({children}: PropsWithChildren<{}>) => {
  return (
    <ModelProvider schema={{foo: {value: ""}, bar: {value: ""}}}>
      {children}
    </ModelProvider>
  )
}) as React.FunctionComponent

describe("Field hook", () => {
  it("does not throw when field name is empty", () => {
    const withoutContext = renderHook(() => useField(""))
    expect(withoutContext.result.error).toBeUndefined()

    const hook = renderHook(() => useField(""), {wrapper: ContextProvider})
    expect(hook.result.error).toBeUndefined()
  })

  it("throws when field name is invalid", () => {
    const name = "missing.model.field"
    const hook = renderHook(() => useField(name), {wrapper: ContextProvider})
    const search = `Missing model field: ${name}`

    expect(hook.result.error.message.includes(search)).toBeTruthy()
  })

  it("rerenders only itself on change", () => {
    const FooComponent = jest.fn(() => {
      const {setValue, name} = useField("foo")
      return <input data-testid={name} name={name} onChange={setValue} />
    }) as React.FunctionComponent
    const BarComponent = jest.fn(() => {
      const {setValue, name} = useField("bar")
      return <input data-testid={name} name={name} onChange={setValue} />
    }) as React.FunctionComponent

    const {getByTestId} = render(
      <ContextProvider>
        <FooComponent />
        <BarComponent />
      </ContextProvider>
    )
    ;(ContextProvider as jest.Mock).mockClear()
    ;(FooComponent as jest.Mock).mockClear()
    ;(BarComponent as jest.Mock).mockClear()

    userEvent.type(getByTestId("foo"), "asd")
    userEvent.type(getByTestId("bar"), "test")

    expect(FooComponent).toHaveBeenCalledTimes(3)
    expect(BarComponent).toHaveBeenCalledTimes(4)
    expect(ContextProvider).toHaveBeenCalledTimes(0)
  })
})
