import {fireEvent} from "@testing-library/react"
import React from "react"
import {ModelProvider} from "../ModelProvider"
import {useModel} from "../useModel"
import {renderStrict} from "../util/TestingUtils"

describe("<ModelProvider />", () => {
  it("updates model options to match the latest ones passed in props", () => {
    const validate1 = jest.fn(() => "initial")
    const validate2 = jest.fn(() => "updated")

    const Component = () => {
      const validate = useModel("validate")
      return <button onClick={validate}>validate</button>
    }

    const {getByText, rerender} = renderStrict(
      <ModelProvider
        schema={{foo: {value: 0}}}
        validate={validate1 as () => any}
      >
        <Component />
      </ModelProvider>
    )

    rerender(
      <ModelProvider
        schema={{foo: {value: 0}}}
        validate={validate2 as () => any}
      >
        <Component />
      </ModelProvider>
    )

    fireEvent.click(getByText("validate"))

    expect(validate1).not.toHaveBeenCalled()
    expect(validate2).toHaveBeenCalled()
  })
})
