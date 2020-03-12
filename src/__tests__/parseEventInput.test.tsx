import {render} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import {parseEventInput} from "../parseEventInput"

describe("parseEventInput()", () => {
  let mockChange: jest.Mock

  beforeEach(() => {
    mockChange = jest.fn((event: any) => parseEventInput(event))
  })

  it("returns input's value for text, password and other 'non-special' types", () => {
    const element = React.createRef<HTMLInputElement>()

    render(<input ref={element} onChange={mockChange} type="text" />)
    userEvent.type(element.current!, "test", {allAtOnce: true})

    expect(mockChange).toHaveLastReturnedWith("test")
  })

  it("returns radio input's value", () => {
    const element = React.createRef<HTMLInputElement>()

    render(
      <input
        ref={element}
        onChange={mockChange}
        type="radio"
        value="radio-test"
      />
    )
    userEvent.click(element.current!)

    expect(mockChange).toHaveLastReturnedWith("radio-test")
  })

  it("returns number input's value as number", () => {
    const element = React.createRef<HTMLInputElement>()

    render(<input ref={element} onChange={mockChange} type="number" />)
    userEvent.type(element.current!, "123.45", {allAtOnce: true})

    expect(mockChange).toHaveLastReturnedWith(123.45)
  })

  it("returns range input's value as number", () => {
    const element = React.createRef<HTMLInputElement>()

    render(<input ref={element} onChange={mockChange} type="range" />)
    userEvent.type(element.current!, "123", {allAtOnce: true})

    expect(mockChange).toHaveLastReturnedWith(123)
  })

  it("returns the boolean checked state of a checkbox", () => {
    const element = React.createRef<HTMLInputElement>()

    render(<input ref={element} onChange={mockChange} type="checkbox" />)
    userEvent.click(element.current!)

    expect(mockChange).toHaveLastReturnedWith(true)
  })

  it("returns select's selected option value", () => {
    const element = React.createRef<HTMLSelectElement>()

    render(
      <select onChange={mockChange} ref={element}>
        <option value="option-1">option-1</option>
        <option value="option-2">option-2</option>
        <option value="option-3">option-3</option>
      </select>
    )

    userEvent.selectOptions(element.current!, "option-2")

    expect(mockChange).toHaveLastReturnedWith("option-2")
  })

  it("returns an array of selected options' values for multiple selects", () => {
    const element = React.createRef<HTMLSelectElement>()

    render(
      <select multiple onChange={mockChange} ref={element}>
        <option value="option-1">option-1</option>
        <option value="option-2">option-2</option>
        <option value="option-3">option-3</option>
      </select>
    )

    const options = ["option-1", "option-3"]
    userEvent.selectOptions(element.current!, options)

    expect(mockChange).toHaveLastReturnedWith(expect.arrayContaining(options))
  })
})
