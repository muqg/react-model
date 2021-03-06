import {fireEvent, render} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import {Model} from "../Model"
import {WebStorage} from "../WebStorage"

const storage = new WebStorage("test")

beforeEach(() => {
  jest.clearAllMocks()
  storage.clear()
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

      const {error, name, value} = model.getField("foo")

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

      const {error, name, value} = model.getField("nested.foo")

      expect(model.values.nested.foo).toBe(10)
      expect(value).toBe(10)
      expect(error).toBe("err")
      expect(name).toBe("nested.foo")
    })

    it("works with array values", () => {
      const data = [1, 2]
      const model = new Model<{nested: {arr: number[]}}>(
        {nested: {arr: {value: data}}},
        {}
      )

      const {initialValue, value} = model.getField("nested.arr")

      expect(value).toEqual(data)
      expect(initialValue).toEqual(data)
      expect(model.values.nested.arr).toEqual(data)
    })

    it("does not include undefined (optional) fields in model values initially", () => {
      type TargetObject = {
        nested: {empty: string | undefined; foo: number}
      }

      const model = new Model<TargetObject>(
        {nested: {empty: {value: undefined}, foo: {value: 1}}},
        {}
      )

      expect("empty" in model.values.nested).toBeFalsy()
    })

    it("initializes model state to the value of options.initialState", () => {
      const model = new Model({}, {initialState: {test: true}})
      expect(model.state).toEqual({test: true})
    })

    describe("with storage", () => {
      type ModelObject = {
        foo: string
        nested: {item: string}
        missing: string
        diff: number
      }

      let model!: Model<ModelObject>

      beforeEach(() => {
        storage.save({
          "diff": {value: "stored"},
          "foo": {value: "initial"},
          "nested.item": {value: "stored"},
        })

        model = new Model<ModelObject>(
          {
            foo: {value: "initial"},
            nested: {item: {value: "initial"}},
            missing: {value: "initial"},
            diff: {value: 10},
          },
          {storage}
        )
      })

      it("initializes values from storage", () => {
        expect(model.getField("nested.item").value).toBe("stored")
      })

      it("marks fields as dirty when their storaged value differs from their initial one", () => {
        expect(model.getField("foo").dirty).toBeFalsy()
        expect(model.getField("missing").dirty).toBeFalsy()
        expect(model.getField("nested.item").dirty).toBeTruthy()
      })

      it("does not set to value from storage if schema and storage types don't match", () => {
        expect(model.getField("diff").value).toBe(10)
      })

      it("does not crash for corrupt storage data", () => {
        storage.save({
          name: "someone",
          surname: null,
        })

        const model = new Model(
          {name: {value: "john"}, surname: {value: "snow"}},
          {storage}
        )

        expect(model.values).toEqual({name: "john", surname: "snow"})
      })
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
      expect(model.getField("foo")).toBe(model.getField("foo"))
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
      nested: {val: string; optional: string | undefined}
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
            optional: {
              value: "initial",
            },
          },
        },
        {onChange}
      )

      model._subscribe(subscriber)
    })

    it("warns when name is an empty string", () => {
      const warn = jest.spyOn(console, "warn").mockImplementationOnce(() => {})
      model.setFieldValue("", 123)

      expect(warn).toHaveBeenCalled()
    })

    describe("when set to a different value", () => {
      it("sets field value", () => {
        const value = 42
        model.setFieldValue("foo", value)

        expect(model.getField("foo").value).toBe(value)
        expect(model.values.foo).toBe(value)
      })

      it("uses custom parser if available", () => {
        model.setFieldValue("parsed", "something else")

        expect(parser).toHaveBeenCalled()
        expect(model.getField("parsed").value).toBe("parsed")
      })

      it("does not mutate the field object iteself", () => {
        const fieldBeforeChange = model.getField("foo")
        model.setFieldValue("foo", 123)

        expect(model.getField("foo")).not.toBe(fieldBeforeChange)
      })

      it("validates field", () => {
        model.setFieldValue("foo", 132)
        expect(model.getField("foo").error).toBe("error")
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
        expect(model.getField("nested.val").dirty).toBe(true)
      })

      it("marks as not dirty when set back to its initial value", () => {
        model.setFieldValue("nested.val", "changed")
        const initialValue = model.getField("nested.val").initialValue
        model.getField("nested.val").setValue(initialValue)

        expect(model.isDirty).toBeFalsy()
        expect(model.getField("nested.val").dirty).toBeFalsy()
      })

      it("marks as touched", () => {
        model.setFieldValue("nested.val", "changed")
        expect(model.isTouched).toBeTruthy()
        expect(model.getField("nested.val").touched).toBeTruthy()

        const initialValue = model.getField("nested.val").initialValue
        model.setFieldValue("nested.val", initialValue)
        expect(model.isTouched).toBeTruthy()
        expect(model.getField("nested.val").touched).toBeTruthy()
      })

      it("validates value and updates error", () => {
        validator.mockImplementation((val) => {
          if (!val) {
            return "error"
          }
        })

        model.getField("foo").setValue(0)
        expect(model.getField("foo").error).toBe("error")

        model.getField("foo").setValue(123)
        expect(model.getField("foo").error).toBeFalsy()
      })

      it("does not validate when shouldValidate argument is false", () => {
        model.setFieldValue("foo", 123, false)
        expect(model.getField("foo").error).toBeFalsy()

        model.getField("foo").setValue(124, false)
        expect(model.getField("foo").error).toBeFalsy()
      })

      it("is not included in model values when set to undefined", () => {
        model.setFieldValue("nested.optional", undefined)
        expect("optional" in model.values.nested).toBeFalsy()

        model.setFieldValue("nested.optional", "")
        expect(model.values.nested.optional).toBe("")
      })

      it("updates storage", () => {
        type ModelObject = {foo: number; nested: {test: number}}

        const model = new Model<ModelObject>(
          {foo: {value: 1}, nested: {test: {value: 2}}},
          {storage}
        )

        const save = jest.spyOn(storage, "save")
        model.setFieldValue("foo", 123)

        // @ts-ignore
        expect(save).toHaveBeenCalledWith(model._fields)
      })
    })

    describe("when set to the same value", () => {
      beforeEach(() => {
        model.setFieldValue("foo", model.values.foo)
      })

      it("does not mark as dirty when value is the same as the initial one", () => {
        expect(model.isDirty).toBe(false)
        expect(model.getField("nested.val").dirty).toBe(false)
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

      it("does not update storage", () => {
        type ModelObject = {foo: number; nested: {test: number}}

        const model = new Model<ModelObject>(
          {foo: {value: 1}, nested: {test: {value: 2}}},
          {storage}
        )

        const save = jest.spyOn(storage, "save")
        model.setFieldValue("foo", model.getField("foo").value)

        // @ts-ignore
        expect(save).not.toHaveBeenCalledWith(model._fields)
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
      render(<input name="foo" onChange={model.handleChange} ref={input} />)
      userEvent.type(input.current!, "asd")

      expect(model.getField("foo").value).toBe("asd")
    })

    it("works with id", () => {
      const input = React.createRef<HTMLInputElement>()
      render(<input id="foo" onChange={model.handleChange} ref={input} />)
      userEvent.type(input.current!, "asd")

      expect(model.getField("foo").value).toBe("asd")
    })

    it("works on blur", () => {
      const input = React.createRef<HTMLInputElement>()
      render(<input name="foo" onBlur={model.handleChange} ref={input} />)
      userEvent.type(input.current!, "asd")
      fireEvent.blur(input.current!)

      expect(model.getField("foo").value).toBe("asd")
    })

    it("does not validate when shouldValidate argument is false", () => {
      const input = React.createRef<HTMLInputElement>()
      render(
        <input
          id="foo"
          onChange={(e) => model.handleChange(e, false)}
          ref={input}
        />
      )
      userEvent.type(input.current!, "asd")

      expect(model.getField("foo").error).toBeFalsy()
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
      model.getField("valid").setValue("test change")

      expect(model.getErrors()).not.toBe(errors)
    })

    it("revalidates fields after a field reset", () => {
      const errors = model.getErrors()
      model.getField("invalid").reset()

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
      expect(model.getField("foo").error).toBe("error")
    })

    it("does not mutate field", () => {
      const fieldBeforeValidation = model.getField("foo")
      model.validateField("foo")

      expect(model.getField("foo")).not.toBe(fieldBeforeValidation)
    })

    it("marks as touched", () => {
      model.validateField("foo")
      expect(model.isTouched).toBeTruthy()
      expect(model.getField("foo").touched).toBeTruthy()
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
      const fieldBeforeRevalidation = model.getField("foo")
      model.validateField("foo")

      expect(model.getField("foo")).toBe(fieldBeforeRevalidation)
    })

    it("does nothing for fields with no validation provided", () => {
      model.validateField("noValidation")

      expect(model.getField("noValidation").error).toBeUndefined()
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
          {onSubmit, storage}
        )

        model.setFieldValue("foo", "changed")
      })

      it("calls options.onSubmit callback before resetting", () => {
        expect.assertions(1)

        onSubmit.mockImplementation((model: Model<SuccessModelObject>) => {
          expect(model.getField("foo").value).toBe("changed")
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
        model.getField("foo").setValue("test")
        await model.submit(submission)

        expect(submission).toHaveBeenCalledTimes(2)
      })

      it("can be submitted again after a field reset", async () => {
        await model.submit(submission, handleError)
        model.getField("foo").reset()
        await model.submit(submission, handleError)

        expect(submission).toHaveBeenCalledTimes(2)
      })

      it("clears storage", async () => {
        const clear = jest.spyOn(storage, "clear")
        await model.submit(submission)

        expect(clear).toHaveBeenCalled()
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
    describe("when called with no argument", () => {
      type ResetMethodModelObject = {foo: string}

      let model: Model<ResetMethodModelObject>
      let onReset: jest.Mock
      let subscriber: jest.Mock

      beforeEach(() => {
        onReset = jest.fn()
        model = new Model<ResetMethodModelObject>(
          {foo: {value: "initial"}},
          {onReset, storage}
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
        expect(model.getField("foo").value).toBe("initial")
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

      it("sets model state to the value of options.initialState", () => {
        const model = new Model({}, {initialState: {val: "initial"}})
        model.setState({val: "changed"})

        model.reset()

        expect(model.state).toEqual({val: "initial"})
      })

      it("notifies subscribers", () => {
        expect(subscriber).toHaveBeenCalledTimes(1)
      })

      it("calls options.onReset callback", () => {
        expect(onReset).toHaveBeenCalledWith(model)
      })

      it("clears storage", () => {
        const clear = jest.spyOn(storage, "clear")
        model.reset()

        expect(clear).toHaveBeenCalled()
      })
    })

    describe("when called with a field name", () => {
      type ResetFieldModelObject = {
        foo: string
        nested: {bar: string; bar2: number; optional: string | undefined}
      }

      let model: Model<ResetFieldModelObject>
      let subscriber: jest.Mock

      beforeEach(() => {
        model = new Model<ResetFieldModelObject>(
          {
            foo: {value: "initial", error: "invalid", validate: () => "error"},
            nested: {
              bar: {value: "initial"},
              bar2: {value: 0},
              optional: {value: undefined},
            },
          },
          {storage}
        )

        subscriber = jest.fn()
        model._subscribe(subscriber)
      })

      it("sets initial value", () => {
        model.getField("foo").setValue("changed")
        model.reset("foo")

        expect(model.getField("foo").value).toBe("initial")
      })

      it("sets initial error", () => {
        model.getField("foo").validate()
        model.reset("foo")

        expect(model.getField("foo").error).toBe("invalid")
      })

      it("makes field not dirty", () => {
        model.getField("foo").setValue("changed")
        model.reset("foo")

        expect(model.getField("foo").dirty).toBeFalsy()
      })

      it("field is not touched", () => {
        model.getField("foo").setValue("changed")
        model.reset("foo")

        expect(model.getField("foo").touched).toBeFalsy()
      })

      it("notifies subscribers", () => {
        model.reset("foo")
        expect(subscriber).toHaveBeenCalled()
      })

      it("does not mutate field", () => {
        const fieldBeforeChange = model.getField("foo")
        model.reset("foo")

        expect(model.getField("foo")).not.toBe(fieldBeforeChange)
      })

      it("updates model values", () => {
        model.getField("foo").setValue("changed")
        model.reset("foo")

        expect(model.values.foo).toBe("initial")
      })

      it("is removed from model values when initial value is undefined", () => {
        model.getField("nested.optional").setValue("test")
        model.reset("nested.optional")

        expect("optional" in model.values.nested).toBeFalsy()
      })

      it("works with nested fields", () => {
        model.getField("nested.bar").setValue("changed")
        model.reset("nested.bar")

        expect(model.getField("nested.bar").value).toBe("initial")
      })

      it("resets all nested fields for a given partial field name", () => {
        model.getField("foo").setValue("changed")
        model.getField("nested.bar").setValue("changed")
        model.getField("nested.bar2").setValue(1)
        model.reset("nested")

        expect(model.getField("foo").value).toBe("changed")
        expect(model.getField("nested.bar").value).toBe("initial")
        expect(model.getField("nested.bar2").value).toBe(0)
      })

      it("updates storage", () => {
        const save = jest.spyOn(storage, "save")
        model.reset("foo")

        // @ts-ignore
        expect(save).toHaveBeenCalledWith(model._fields)
      })
    })
  })

  describe("state", () => {
    let model: Model

    beforeEach(() => {
      model = new Model<any>({foo: {value: 1}}, {})
    })

    it("merges input shallowly with current state", () => {
      model.setState({test: true})
      model.setState({foo: true})

      expect(model.state).toEqual({test: true, foo: true})

      model.setState({test: false, foo: {deep: true}})

      expect(model.state).toEqual({foo: {deep: true}, test: false})
    })

    it("notifies subscribers when setting a new state", () => {
      const subscriber = jest.fn()
      model._subscribe(subscriber)

      model.setState({test: true})

      expect(subscriber).toHaveBeenCalled()
    })

    it("can be given a function to derive state from", () => {
      model.setState({val: "test"})
      model.setState(({val}) => {
        return {another: val}
      })

      expect(model.state).toEqual({val: "test", another: "test"})
    })
  })
})
