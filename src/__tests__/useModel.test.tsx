import {fireEvent, render} from "@testing-library/react"
import {renderHook} from "@testing-library/react-hooks"
import React, {PropsWithChildren} from "react"
import {Model} from "../Model"
import {ModelProvider} from "../ModelProvider"
import {useField} from "../useField"
import {useModel} from "../useModel"
import {renderStrict} from "../util/TestingUtils"

type ProviderModelObject = {foo: string}

const Provider = ({children}: PropsWithChildren<{}>) => {
  return (
    <ModelProvider schema={{foo: {value: "val", error: "err"}}}>
      {children}
    </ModelProvider>
  )
}

describe("Model hook", () => {
  it("works with model context", () => {
    const hook = renderHook(() => useModel<ProviderModelObject>(), {
      wrapper: Provider,
    })
    const model = hook.result.current

    expect(model.getField("foo").value).toBe("val")
    expect(model.getField("foo").error).toBe("err")
  })

  describe("selectors", () => {
    it("subscribes to changes when selecting a model property", () => {
      let model!: Model<any>
      let spy!: jest.SpyInstance<any>

      const Component = () => {
        model = useModel()
        spy = jest.spyOn(model, "_subscribe")

        useModel("isDirty")

        return null
      }

      renderStrict(
        <ModelProvider schema={{foo: {value: 1}}}>
          <Component />
        </ModelProvider>
      )

      // Should be called twice -- once for the useModel() call
      // and once for the property selector call.
      expect(spy).toHaveBeenCalledTimes(2)
    })

    it("does not subscribe to changes when selecting a model method", () => {
      let model!: Model<any>
      let spy!: jest.SpyInstance<any>

      const Component = () => {
        model = useModel()
        spy = jest.spyOn(model, "_subscribe")

        useModel("getField")

        return null
      }

      renderStrict(
        <ModelProvider schema={{foo: {value: 1}}}>
          <Component />
        </ModelProvider>
      )

      // Should be called only once for the useModel() call
      // and not for the property selector call.
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it("returns the selected method or property", () => {
      let model!: Model<any>
      let validate!: any
      let values!: any

      const Component = () => {
        model = useModel()
        validate = useModel("validate")
        values = useModel("values")

        return null
      }

      renderStrict(
        <ModelProvider schema={{foo: {value: 1}}}>
          <Component />
        </ModelProvider>
      )

      expect(validate).toBe(model.validate)
      expect(values).toBe(model.values)
    })

    it("returns the updated model property result when it changes", async () => {
      let result: any

      const Input = () => {
        const {setValue} = useField("foo")
        return <input data-testid="input" name="foo" onChange={setValue} />
      }

      const Component = () => {
        result = useModel("isDirty")
        return <Input />
      }

      const {getByTestId} = renderStrict(
        <ModelProvider schema={{foo: {value: "initial"}}}>
          <Component />
        </ModelProvider>
      )

      fireEvent.change(getByTestId("input"), {target: {value: "changed"}})
      expect(result).toBeTruthy()

      fireEvent.change(getByTestId("input"), {target: {value: "initial"}})
      expect(result).toBeFalsy()
    })

    it("does not allow private methods or properties to be selected", () => {
      console.error = jest.fn()

      const Component = () => {
        useModel("_subscribe")
        return null
      }

      const renderComponent = () =>
        render(
          <ModelProvider schema={{foo: {value: 1}}}>
            <Component />
          </ModelProvider>
        )

      expect(renderComponent).toThrowError(
        "Attempting to select undefined model property '_subscribe'"
      )
    })

    it("throws when selecting invalid method or property", () => {
      console.error = jest.fn()

      const Component = () => {
        useModel("invalid_key" as any)
        return null
      }

      const renderComponent = () =>
        render(
          <ModelProvider schema={{foo: {value: 1}}}>
            <Component />
          </ModelProvider>
        )

      expect(renderComponent).toThrowError(
        "Attempting to select undefined model property 'invalid_key'"
      )
    })

    it("only updates when selected property changes", () => {
      const Input = () => {
        const {setValue} = useField("foo")
        return <input data-testid="input" name="foo" onChange={setValue} />
      }

      const IsDirtySelector = jest.fn(() => {
        useModel("isDirty")
        return null
      }) as React.FunctionComponent

      const IsSubmittingSelector = jest.fn(() => {
        useModel("isSubmitting")
        return null
      }) as React.FunctionComponent

      const {getByTestId} = renderStrict(
        <ModelProvider schema={{foo: {value: 1}}}>
          <Input />
          <IsDirtySelector />
          <IsSubmittingSelector />
        </ModelProvider>
      )

      jest.clearAllMocks()

      fireEvent.change(getByTestId("input"), {target: {value: "changed"}})

      expect(IsDirtySelector).toHaveBeenCalled()
      expect(IsSubmittingSelector).not.toHaveBeenCalled()
    })
  })
})
