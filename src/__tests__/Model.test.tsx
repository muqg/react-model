import {render, fireEvent} from "@testing-library/react"
import {Model} from "../Model"
import userEvent from "@testing-library/user-event"
import React from "react"

console.warn = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
})

describe("Model instance", () => {
  describe("construction", () => {
    it("works with a flat schema", () => {
      const model = new Model(
        {
          foo: {
            value: "asd",
            error: "Invalid value",
          },
        },
        {}
      )

      const {error, name, value} = model.fields.foo

      expect(model.values.foo).toBe("asd")
      expect(value).toBe("asd")
      expect(error).toBe("Invalid value")
      expect(name).toBe("foo")
    })

    it("works with nested object schema", () => {
      const model = new Model<{nested: {foo: number}}>(
        {
          nested: {
            foo: {
              error: "err",
              value: 10,
            },
          },
        },
        {}
      )

      const {error, name, value} = model.fields.nested.foo

      expect(model.values.nested.foo).toBe(10)
      expect(value).toBe(10)
      expect(error).toBe("err")
      expect(name).toBe("nested.foo")
    })
  })

  describe("getField() method", () => {
    type GetFieldModelObject = {foo: string; nested: {bar: string}}

    let model: Model<GetFieldModelObject>

    beforeEach(() => {
      model = new Model<GetFieldModelObject>(
        {foo: {value: "test"}, nested: {bar: {value: ""}}},
        {}
      )
    })

    it("returns model field for given key", () => {
      expect(model.getField("foo")).toBe(model.fields.foo)
    })

    it("throws when called with an empty string", () => {
      expect(() => model.getField("")).toThrow()
    })

    it("throws on missing field at key", () => {
      expect(() => model.getField("invalid.key")).toThrow()
    })

    it("throws when key does not point to a model field", () => {
      expect(() => model.getField("nested")).toThrow()
    })
  })

  describe("setFieldValue() method", () => {
    type SetFieldValueModelObject = {
      foo: number
      parsed: string
      nested: {val: string}
    }

    let model: Model<SetFieldValueModelObject>
    let onChange: jest.Mock
    let parser: jest.Mock
    let subscriber: jest.Mock
    let validator: jest.Mock

    beforeEach(() => {
      onChange = jest.fn()
      parser = jest.fn(() => "parsed")
      subscriber = jest.fn()
      validator = jest.fn(() => "error")

      model = new Model<SetFieldValueModelObject>(
        {
          foo: {value: 10, validate: validator},
          parsed: {value: "pp", parse: parser},
          nested: {
            val: {
              value: "initial",
            },
          },
        },
        {onChange}
      )

      model._subscribe(subscriber)
    })

    it("warns when name is an empty string", () => {
      model.setFieldValue("", 123)
      expect(console.warn).toHaveBeenCalled()
    })

    describe("when set to a different value", () => {
      it("sets field value", () => {
        const value = 42
        model.setFieldValue("foo", value)

        expect(model.fields.foo.value).toBe(value)
        expect(model.values.foo).toBe(value)
      })

      it("uses custom parser if available", () => {
        model.setFieldValue("parsed", "something else")

        expect(parser).toHaveBeenCalled()
        expect(model.fields.parsed.value).toBe("parsed")
      })

      it("does not mutate fields object", () => {
        const fieldsBeforeChange = model.fields
        model.setFieldValue("foo", 123)

        expect(model.fields).not.toBe(fieldsBeforeChange)
      })

      it("does not mutate the field object iteself", () => {
        const fieldBeforeChange = model.fields.foo
        model.setFieldValue("foo", 123)

        expect(model.fields.foo).not.toBe(fieldBeforeChange)
      })

      it("validates field", () => {
        model.setFieldValue("foo", 132)
        expect(model.fields.foo.error).toBe("error")
      })

      it("notifies on change", () => {
        model.setFieldValue("foo", 123)
        expect(subscriber).toHaveBeenCalled()
      })

      it("calls options.onChange callback", () => {
        model.setFieldValue("foo", 123)
        expect(onChange).toHaveBeenCalledWith(model)
      })

      it("marks as dirty when not the same as the initial value", () => {
        model.setFieldValue("nested.val", "changed")

        expect(model.isDirty).toBe(true)
        expect(model.fields.nested.val.dirty).toBe(true)
      })

      it("marks as not dirty when set back to its initial value", () => {
        model.setFieldValue("nested.val", "changed")
        model.fields.nested.val.change(model.fields.nested.val.initialValue)

        expect(model.isDirty).toBeFalsy()
        expect(model.fields.nested.val.dirty).toBeFalsy()
      })

      it("marks as touched", () => {
        model.setFieldValue("nested.val", "changed")
        expect(model.isTouched).toBeTruthy()
        expect(model.fields.nested.val.touched).toBeTruthy()

        model.setFieldValue("nested.val", model.fields.nested.val.initialValue)
        expect(model.isTouched).toBeTruthy()
        expect(model.fields.nested.val.touched).toBeTruthy()
      })

      it("validates value and updates error", () => {
        validator.mockImplementation(val => {
          if (!val) {
            return "error"
          }
        })

        model.fields.foo.change(0)
        expect(model.fields.foo.error).toBe("error")

        model.fields.foo.change(123)
        expect(model.fields.foo.error).toBeFalsy()
      })

      it("does not validate when shouldValidate argument is false", () => {
        model.setFieldValue("foo", 123, false)
        expect(model.fields.foo.error).toBeFalsy()

        model.fields.foo.change(124, false)
        expect(model.fields.foo.error).toBeFalsy()
      })
    })

    describe("when set to the same value", () => {
      beforeEach(() => {
        model.setFieldValue("foo", model.values.foo)
      })

      it("does not mark as dirty when value is the same as the initial one", () => {
        expect(model.isDirty).toBe(false)
        expect(model.fields.nested.val.dirty).toBe(false)
      })

      it("does not validate", () => {
        expect(validator).not.toHaveBeenCalled()
      })

      it("does not notify", () => {
        expect(subscriber).not.toHaveBeenCalled()
      })

      it("does not call options.onChange callback", () => {
        expect(onChange).not.toHaveBeenCalled()
      })
    })
  })

  describe("handleChange() method", () => {
    let model: Model<{foo: string}>

    beforeEach(() => {
      model = new Model<{foo: string}>(
        {foo: {value: "", validate: () => "error"}},
        {}
      )
    })

    it("works with name", () => {
      const input = React.createRef<HTMLInputElement>()
      render(
        <input
          name={model.fields.foo.name}
          onChange={model.handleChange}
          ref={input}
        />
      )
      userEvent.type(input.current!, "asd")

      expect(model.fields.foo.value).toBe("asd")
    })

    it("works with id", () => {
      const input = React.createRef<HTMLInputElement>()
      render(
        <input
          id={model.fields.foo.name}
          onChange={model.handleChange}
          ref={input}
        />
      )
      userEvent.type(input.current!, "asd")

      expect(model.fields.foo.value).toBe("asd")
    })

    it("works on blur", () => {
      const input = React.createRef<HTMLInputElement>()
      render(
        <input
          name={model.fields.foo.name}
          onBlur={model.handleChange}
          ref={input}
        />
      )
      userEvent.type(input.current!, "asd")
      fireEvent.blur(input.current!)

      expect(model.fields.foo.value).toBe("asd")
    })

    it("does not validate when shouldValidate argument is false", () => {
      const input = React.createRef<HTMLInputElement>()
      render(
        <input
          id={model.fields.foo.name}
          onChange={e => model.handleChange(e, false)}
          ref={input}
        />
      )
      userEvent.type(input.current!, "asd")

      expect(model.fields.foo.error).toBeFalsy()
    })
  })

  describe("getErrors() method", () => {
    type GetErrorsModelObject = {
      valid: string
      invalid: string
      nested: {item: string}
    }
    let model: Model<GetErrorsModelObject>

    beforeEach(() => {
      model = new Model<GetErrorsModelObject>(
        {
          invalid: {
            value: "test",
            validate: () => "error",
          },
          nested: {
            item: {
              value: "test",
              validate: () => "nested error",
            },
          },
          valid: {
            value: "valid value",
          },
        },
        {}
      )
    })

    it("returns model's errors as a record of name/error pairs", () => {
      expect(model.getErrors()).toEqual({
        "invalid": "error",
        "nested.item": "nested error",
      })
    })

    it("does not perform validation again for unchanged model when called more than once", () => {
      const errors = model.getErrors()
      expect(model.getErrors()).toBe(errors)
    })

    it("revalidates fields after a model change", () => {
      const errors = model.getErrors()
      model.fields.valid.change("test change")

      expect(model.getErrors()).not.toBe(errors)
    })

    it("revalidates fields after a field reset", () => {
      const errors = model.getErrors()
      model.fields.invalid.reset()

      expect(model.getErrors()).not.toBe(errors)
    })

    it("calls options.validate() callback", () => {
      const model = new Model(
        {foo: {value: 10}, bar: {value: 12, validate: () => "error"}},
        {validate: () => ({foo: "invalid"})}
      )

      expect(model.getErrors()).toEqual({bar: "error", foo: "invalid"})
    })
  })

  describe("validate() method", () => {
    let model: Model
    let subscriber: jest.Mock

    beforeEach(() => {
      subscriber = jest.fn()
      model = new Model<any>({foo: {value: 1}}, {})
      model._subscribe(subscriber)
    })

    it("notifies subscribers", () => {
      model.validate()
      expect(subscriber).toHaveBeenCalled()
    })

    it("does not notify subscribers for unchanged model when called more than", () => {
      model.validate()
      model.validate()
      model.validate()

      expect(subscriber).toHaveBeenCalledTimes(1)
    })
  })

  describe("validateField() method", () => {
    type ValidateFieldModelObject = {foo: number; noValidation: number}
    let model: Model<ValidateFieldModelObject>
    let subscriber: jest.Mock

    beforeEach(() => {
      subscriber = jest.fn()
      model = new Model(
        {foo: {value: 10, validate: () => "error"}, noValidation: {value: 2}},
        {}
      )
      model._subscribe(subscriber)
    })

    it("throws when attempting to validate a missing model field", () => {
      expect(() => model.validateField("invalid.field.name")).toThrow()
    })

    it("validates field", () => {
      model.validateField("foo")
      expect(model.fields.foo.error).toBe("error")
    })

    it("does not mutate field", () => {
      const fieldBeforeValidation = model.fields.foo
      model.validateField("foo")

      expect(model.fields.foo).not.toBe(fieldBeforeValidation)
    })

    it("does not mutate model fields", () => {
      const fieldsBeforeValidation = model.fields
      model.validateField("foo")

      expect(model.fields).not.toBe(fieldsBeforeValidation)
    })

    it("marks as touched", () => {
      model.validateField("foo")
      expect(model.isTouched).toBeTruthy()
      expect(model.fields.foo.touched).toBeTruthy()
    })

    it("notifies subscribers", () => {
      model.validateField("foo")
      expect(subscriber).toHaveBeenCalled()
    })

    it("does not notify subscribers when validation results in the same error", () => {
      model.validateField("foo")
      model.validateField("foo")
      model.validateField("foo")

      expect(subscriber).toHaveBeenCalledTimes(1)
    })

    it("does not mutate field when current error is the same as the previous one", () => {
      model.validateField("foo")
      const fieldBeforeRevalidation = model.fields.foo
      model.validateField("foo")

      expect(model.fields.foo).toBe(fieldBeforeRevalidation)
    })

    it("does nothing for fields with no validation provided", () => {
      model.validateField("noValidation")

      expect(model.fields.noValidation.error).toBeUndefined()
      expect(subscriber).not.toHaveBeenCalled()
    })
  })

  describe("submit() method", () => {
    let submission: jest.Mock
    let handleError: jest.Mock

    beforeEach(() => {
      submission = jest.fn(() => Promise.resolve("success"))
      handleError = jest.fn()
    })

    it("sets submitting to true when submission starts", () => {
      const model = new Model({foo: {value: 1}}, {})
      model.submit(submission, handleError)

      expect(model.isSubmitting).toBe(true)
    })

    it("cannot be called again while already submitting", () => {
      const model = new Model({foo: {value: 1}}, {})

      model.submit(submission)
      model.submit(submission)
      model.submit(submission)

      expect(submission).toHaveBeenCalledTimes(1)
    })

    describe("on validation error", () => {
      let model: Model

      beforeEach(async () => {
        model = new Model<any>(
          {foo: {value: 1, validate: () => "invalid value"}},
          {}
        )

        await model.submit(submission, handleError)
      })

      it("sets submitting to false on validation errors", () => {
        expect(model.isSubmitting).toBe(false)
      })

      it("calls handleError callback", () => {
        expect(handleError).toHaveBeenCalledWith(
          expect.objectContaining({foo: "invalid value"})
        )
      })

      it("does not call submission callback", () => {
        expect(submission).not.toHaveBeenCalled()
      })

      it("cannot be submitted again for unchanged model", async () => {
        await model.submit(submission, handleError)
        await model.submit(submission, handleError)

        expect(handleError).toHaveBeenCalledTimes(1)
      })

      it("can be submitted again after a model change", () => {
        model.setFieldValue("foo", 2)
        model.submit(submission, handleError)

        expect(handleError).toHaveBeenCalledTimes(2)
      })
    })

    describe("on success", () => {
      type SuccessModelObject = {foo: string}

      let model: Model<SuccessModelObject>
      let onSubmit: jest.Mock

      beforeEach(() => {
        onSubmit = jest.fn()
        model = new Model<SuccessModelObject>(
          {foo: {value: "initial"}},
          {onSubmit}
        )

        model.setFieldValue("foo", "changed")
      })

      it("calls options.onSubmit callback before resetting", () => {
        expect.assertions(1)

        onSubmit.mockImplementation((model: Model<SuccessModelObject>) => {
          expect(model.fields.foo.value).toBe("changed")
        })

        model.submit(submission)
      })

      it("sets submitting to false", async () => {
        await model.submit(submission)
        expect(model.isSubmitting).toBe(false)
      })

      it("returns the result of the submission callback", () => {
        return expect(model.submit(submission)).resolves.toBe("success")
      })

      it("cannot be submitted again for unchanged model", async () => {
        await model.submit(submission)
        await model.submit(submission)
        await model.submit(submission)

        expect(submission).toHaveBeenCalledTimes(1)
      })

      it("can be submitted again after a model change", async () => {
        await model.submit(submission)
        model.fields.foo.change("test")
        await model.submit(submission)

        expect(submission).toHaveBeenCalledTimes(2)
      })

      it("can be submitted again after a field reset", async () => {
        await model.submit(submission, handleError)
        model.fields.foo.reset()
        await model.submit(submission, handleError)

        expect(submission).toHaveBeenCalledTimes(2)
      })
    })

    describe("when an exception is thrown", () => {
      let model: Model

      beforeEach(() => {
        model = new Model<any>({foo: {value: 1}}, {})

        const message = "failed submission"
        submission.mockImplementationOnce(() => {
          throw Error(message)
        })

        return expect(model.submit(submission)).rejects.toThrow(message)
      })

      it("sets submitting to false", () => {
        expect(model.isSubmitting).toBe(false)
      })

      it("can be submitted immediately afterwards", () => {
        model.submit(submission)
        expect(submission).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe("reset() method", () => {
    type ResetMethodModelObject = {foo: string}

    let model: Model<ResetMethodModelObject>
    let onReset: jest.Mock
    let subscriber: jest.Mock

    beforeEach(() => {
      onReset = jest.fn()
      model = new Model<ResetMethodModelObject>(
        {foo: {value: "initial"}},
        {onReset}
      )
      model.setFieldValue("foo", "changed")

      subscriber = jest.fn()
      model._subscribe(subscriber)

      expect(model.values.foo).toBe("changed")
      model.reset()
    })

    it("sets values to their initial state", () => {
      expect(model.values.foo).toBe("initial")
    })

    it("sets fields to their initial state", () => {
      expect(model.fields.foo.value).toBe("initial")
    })

    it("is not marked as dirty", () => {
      expect(model.isDirty).toBe(false)
    })

    it("is not marked as touched", () => {
      expect(model.isTouched).toBeFalsy()
    })

    it("can perform fresh validation after reset", () => {
      const errorsBeforeReset = model.getErrors()
      model.reset()

      expect(model.getErrors()).not.toBe(errorsBeforeReset)
    })

    it("can be submitted again after reset", () => {
      const submission = jest.fn()
      model.submit(submission)

      model.reset()

      model.submit(submission)
      model.submit(submission)

      expect(submission).toHaveBeenCalledTimes(2)
    })

    it("notifies subscribers", () => {
      expect(subscriber).toHaveBeenCalledTimes(1)
    })

    it("calls options.onReset callback", () => {
      expect(onReset).toHaveBeenCalledWith(model)
    })
  })

  describe("resetField() method", () => {
    let model: Model<{foo: string}>
    let subscriber: jest.Mock

    beforeEach(() => {
      model = new Model(
        {foo: {value: "initial", error: "invalid", validate: () => "error"}},
        {}
      )

      subscriber = jest.fn()
      model._subscribe(subscriber)
    })

    it("sets initial value", () => {
      model.fields.foo.change("changed")
      model.resetField("foo")

      expect(model.fields.foo.value).toBe("initial")
    })

    it("sets initial error", () => {
      model.fields.foo.validate()
      model.resetField("foo")

      expect(model.fields.foo.error).toBe("invalid")
    })

    it("makes field not dirty", () => {
      model.fields.foo.change("changed")
      model.resetField("foo")

      expect(model.fields.foo.dirty).toBeFalsy()
    })

    it("field is not touched", () => {
      model.fields.foo.change("changed")
      model.resetField("foo")

      expect(model.fields.foo.touched).toBeFalsy()
    })

    it("notifies subscribers", () => {
      model.resetField("foo")
      expect(subscriber).toHaveBeenCalled()
    })

    it("does not mutate field", () => {
      const fieldBeforeChange = model.fields.foo
      model.resetField("foo")

      expect(model.fields.foo).not.toBe(fieldBeforeChange)
    })

    it("does not mutate model fields", () => {
      const fieldsBeforeChange = model.fields
      model.resetField("foo")

      expect(model.fields).not.toBe(fieldsBeforeChange)
    })

    it("updates model values", () => {
      model.fields.foo.change("changed")
      model.resetField("foo")

      expect(model.values.foo).toBe("initial")
    })
  })
})
