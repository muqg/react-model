import {renderHook} from "@testing-library/react-hooks"
import React, {PropsWithChildren} from "react"
import {ModelProvider} from "../ModelProvider"
import {useModel} from "../useModel"

type ProviderModelObject = {foo: string}

const Provider = ({children}: PropsWithChildren<{}>) => {
  return (
    <ModelProvider schema={{foo: {value: "val", error: "err"}}}>
      {children}
    </ModelProvider>
  )
}

describe("Model hook", () => {
  it("throws when called with no arguments outside of model context", () => {
    const hook = renderHook(() => useModel())
    const {message} = hook.result.error

    expect(message).toBe(
      "useModel hook can only be called with no arguments in children of " +
        "<ModelProvider />, otherwise you should provide it with an object schema."
    )
  })

  it("works with model context", () => {
    const hook = renderHook(() => useModel<ProviderModelObject>(), {
      wrapper: Provider,
    })
    const model = hook.result.current

    expect(model.fields.foo.value).toBe("val")
    expect(model.fields.foo.error).toBe("err")
  })

  it("works with schema", () => {
    const hook = renderHook(() => useModel({foo: {value: 1, error: "test"}}))
    const model = hook.result.current

    expect(model.fields.foo.value).toBe(1)
    expect(model.fields.foo.error).toBe("test")
  })

  it("prefers schema over context", () => {
    const hook = renderHook(
      () => useModel<ProviderModelObject>({foo: {value: "schema"}}),
      {
        wrapper: Provider,
      }
    )
    const model = hook.result.current

    expect(model.fields.foo.value).toBe("schema")
  })
})
