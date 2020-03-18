import {fireEvent, act} from "@testing-library/react"
import React, {FormEvent} from "react"
import {Form} from "../Form"
import {renderStrict} from "../util/TestingUtils"

describe("Form component", () => {
  describe("submission", () => {
    it("calls onSubmit callback", () => {
      const onSubmit = jest.fn()
      const {getByText} = renderStrict(
        <Form schema={{foo: {value: 1}}} onSubmit={onSubmit}>
          <button type="submit">submit</button>
        </Form>
      )

      fireEvent.click(getByText("submit"))

      expect(onSubmit).toHaveBeenCalled()
    })

    it("calls handleError callback when there are model validation errors", () => {
      const handleError = jest.fn()
      const {getByText} = renderStrict(
        <Form
          schema={{foo: {value: 1, validate: () => "error"}}}
          handleError={handleError}
        >
          <button type="submit">submit</button>
        </Form>
      )

      fireEvent.click(getByText("submit"))

      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({foo: "error"})
      )
    })

    it("prevents submit event default behaviour", () => {
      expect.assertions(1)

      const onSubmit = jest.fn((e: FormEvent<any>) =>
        expect(e.isDefaultPrevented()).toBeTruthy()
      )
      const {getByText} = renderStrict(
        <Form schema={{foo: {value: 1}}} onSubmit={onSubmit}>
          <button type="submit">submit</button>
        </Form>
      )

      fireEvent.click(getByText("submit"))
    })

    it("resets model when resetOnSubmit is true", async () => {
      const onReset = jest.fn()
      const {getByText, rerender} = renderStrict(
        <Form
          schema={{foo: {value: 1}}}
          onSubmit={() => {}}
          options={{onReset}}
        >
          <button type="submit">submit</button>
        </Form>
      )

      await act(async () => {
        fireEvent.click(getByText("submit"))
      })

      expect(onReset).not.toHaveBeenCalled()

      rerender(
        <Form
          schema={{foo: {value: 1}}}
          onSubmit={() => {}}
          options={{onReset}}
          resetOnSubmit={true}
        >
          <button type="submit">submit</button>
        </Form>
      )

      await act(async () => {
        fireEvent.click(getByText("submit"))
      })

      expect(onReset).toHaveBeenCalled()
    })
  })

  describe("reset", () => {
    it("calls onReset callback on reset", () => {
      const onReset = jest.fn()
      const {getByText} = renderStrict(
        <Form schema={{foo: {value: 1}}} onReset={onReset}>
          <button type="reset">reset</button>
        </Form>
      )

      fireEvent.click(getByText("reset"))

      expect(onReset).toHaveBeenCalled()
    })

    it("prevents reset event default behaviour", () => {
      expect.assertions(1)

      const onReset = jest.fn((e: FormEvent<any>) =>
        expect(e.isDefaultPrevented()).toBeTruthy()
      )
      const {getByText} = renderStrict(
        <Form schema={{foo: {value: 1}}} onReset={onReset}>
          <button type="reset">reset</button>
        </Form>
      )

      fireEvent.click(getByText("reset"))
    })
  })
})
