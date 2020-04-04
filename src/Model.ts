import {ParseableEvent, parseEventInput} from "./parseEventInput"
import {
  ModelErrors,
  ModelField,
  ModelOptions,
  ModelSchema,
  ModelSchemaField,
  ModelValidationError,
} from "./types"
import {insert, isObject, retrieve} from "./util/ObjectUtils"

type ModelFieldUtils = Omit<ModelSchemaField, "error" | "value">
type ModelSubscriber<T extends object = any> = (model: Model<T>) => void

type State<T extends object = any> = {
  errors?: ModelErrors
  submitted?: boolean
  values?: T
}

const noop: () => any = () => {}

const DefaultOptions: ModelOptions = {
  onChange: noop,
  onReset: noop,
  onSubmit: noop,
  validate: noop,
}

// By using the keys of a fake SchemaField object we can make use of
// Typescript's assitance to never miss a valid key.
const ValidSchemaFieldKeys: Record<keyof ModelSchemaField, boolean> = {
  error: true,
  parse: true,
  value: true,
  validate: true,
}

function isSchemaFieldObject(input: any): input is ModelSchemaField {
  return (
    isObject(input) && Object.keys(input).every((k) => ValidSchemaFieldKeys[k])
  )
}

function isEventInput(input: any): input is ParseableEvent {
  return isObject(input) && "target" in input && input.target instanceof Element
}

export class Model<T extends object = any> implements Model<T> {
  private _submitting = false

  /**
   * Current state memory. It stores variables
   * which are cleared on model value change.
   */
  private _mem: State = {}
  private _fields: Record<string, ModelField> = {}
  private _utils: Record<string, ModelFieldUtils> = {}

  private readonly _options: ModelOptions<T>
  private readonly _schema: ModelSchema<T>
  private readonly _subs = new Set<ModelSubscriber<T>>()

  constructor(schema: ModelSchema<T>, options: Partial<ModelOptions<T>>) {
    this._schema = schema
    this._options = {...DefaultOptions, ...options} as ModelOptions<T>

    this._setupInitialState()
  }

  /**
   * Whether any of the model's fields is dirty.
   */
  get isDirty() {
    return Object.values(this._fields).some((f) => f.dirty)
  }

  /**
   * Whether any of the model's fields is touched.
   */
  get isTouched() {
    return Object.values(this._fields).some((f) => f.touched)
  }

  /**
   * Whether the model is currently being submitted.
   */
  get isSubmitting() {
    return this._submitting
  }

  /**
   * Model's fields' values shaped like the target object. `undefined`
   * values are not present, since they are considered to be optional,
   * and in this case -- not set.
   */
  get values(): T {
    let values = this._mem.values

    if (!values) {
      values = {}

      Object.values(this._fields).forEach(({name, value}) => {
        if (value !== undefined) {
          values = insert(values, name, value)
        }
      })

      this._mem.values = values
    }

    return values
  }

  /**
   * Returns a model field using dot notation.
   *
   * @param name Target field name using dot notation.
   */
  getField<T = any>(name: string): ModelField<T> {
    const field = this._fields[name]

    if (!field) {
      throw new Error(
        `Missing model field: ${name}\n` +
          "This field was not part of the initial schema and is possibly an error in your code."
      )
    }

    return field
  }

  private _updateField(
    field: ModelField,
    changes: Partial<ModelField>
  ): ModelField {
    const updatedField = {...field, ...changes}
    const name = field.name

    updatedField.touched = true
    updatedField.dirty = updatedField.initialValue !== changes.value

    this._fields[name] = updatedField

    return updatedField
  }

  /**
   * Handle a model field change event.
   *
   * @param event Input change or focus event.
   * @param shouldValidate Whether the value should be validated. Enabled
   * by default.
   */
  handleChange = (event: ParseableEvent, shouldValidate?: boolean): void => {
    const key = event.target.name || event.target.id
    this.setFieldValue(key, event, shouldValidate)
  }

  /**
   * Set the value of a model field.
   *
   * @param name Target field name using dot notation.
   * @param input Input value.
   * @param shouldValidate Whether the value should be validated. Enabled
   * by default.
   */
  setFieldValue(name: string, input: any, shouldValidate = true): void {
    if (!name) {
      // TODO: Consider implementing as a DEV only warning.
      console.warn(
        "Attempting to change a model value for input with no name or id. " +
          "This is possibly an error and you have forgotten to give your input a name."
      )
      return
    }

    let field = this.getField(name)

    let value = input
    const {parse} = this._utils[name]

    if (parse) {
      value = parse(input, field.value, name)
    } else if (isEventInput(input)) {
      value = parseEventInput(input)
    }

    // Nothing has changed, no action should be performed.
    if (field.value === value) {
      return
    }

    // Model's state should be cleared on value change in order
    // to allow its methods to operate properly on the newest data.
    this._mem = {}

    field = this._updateField(field, {value})
    if (shouldValidate) {
      this._performFieldValidation(field)
    }

    this._notify()
    this._options.onChange(this)
  }

  /**
   * Validate model.
   */
  validate = (): ModelErrors => {
    const shouldNotify = !this._mem.errors
    const errors = this.getErrors()

    if (shouldNotify) {
      this._notify()
    }

    return errors
  }

  /**
   * Get model errors. This method performs validation on all model fields,
   * without notifying subscribers and hence not causing a render/update.
   */
  getErrors(): ModelErrors {
    if (!this._mem.errors) {
      const errors: ModelErrors = {}

      Object.values(this._fields).forEach((field) => {
        const error = this._performFieldValidation(field)
        if (error) {
          errors[field.name] = error
        }
      })

      const validateOptionErrors = this._options.validate(this.values, errors)
      this._mem.errors = {...errors, ...validateOptionErrors}
    }

    return this._mem.errors
  }

  /**
   * Wether any of the fields does not pass validation and has an error.
   */
  hasError(): boolean {
    return Object.keys(this.getErrors()).length > 0
  }

  /**
   * Validate a single model field.
   *
   * @param name Target field name using dot notation.
   */
  validateField(name: string): ModelValidationError {
    const field = this.getField(name)
    const error = this._performFieldValidation(field)

    // Don't notify if the field's error is the same as the
    // previous one in order to bail out of unnecessary updates.
    if (field.error !== error) {
      this._notify()
    }

    return error
  }

  private _performFieldValidation(field: ModelField): ModelValidationError {
    const {name, value} = field
    const {validate} = this._utils[name]
    const error = validate?.(value, this.values)

    if (field.error !== error) {
      this._updateField(field, {error})
      delete this._mem.errors
    }

    return error
  }

  /**
   * Perform model submission. It also runs validation to make sure that all
   * fields are valid before calling the submission callback.
   *
   * @param submit Callback to handle model's submission.
   * @param handleError Called instead of the submit callback whenever the model
   * has an error.
   */
  async submit<R = any>(
    submit: (data: T) => R,
    handleError: (errors: ModelErrors) => void = noop
  ): Promise<R | undefined> {
    // Should not be allowed to be called more than once, unless there was
    // a model change, in which case this variable should have been reset
    // to `false` or `undefined`.
    if (this._mem.submitted) {
      return
    }

    try {
      this._setSubmitting(true)
      this._mem.submitted = true

      const errors = this.validate()
      if (this.hasError()) {
        handleError(errors)
      } else {
        const result = submit(this.values)
        if (result instanceof Promise) {
          // The submission result is awaited for in order
          // to discard duplicate calls to this method for
          // the entire duration of the submission.
          await result
        }

        this._options.onSubmit(this)

        return result
      }
    } catch (err) {
      // Method cannot be called a second time until the first call is
      // finished, and therefore no race condition can occur.
      this._mem.submitted = false

      throw err
    } finally {
      this._setSubmitting(false)
    }
  }

  private _setSubmitting(value: boolean): void {
    this._submitting = value
    this._notify()
  }

  /**
   * Reset the model instance or one or more of its fields to their initial state.
   *
   * It will reset the model instance to its initial state when called with no
   * argument or with an empty string.
   *
   * ```ts
   * // Reset model to its initial state.
   * model.reset()
   * ```
   *
   * It will reset a single field when called with a valid field name as an
   * argument. It can also be called with a partial field name in order to reset
   * all fields which start with the same part. Example:
   *
   * ```ts
   * // Reset a single field.
   * model.reset("foo")
   *
   * // Reset all nested fields for a partial key. This call here will reset
   * // all fields such as nested.foo, nested.foo2, nested.deeper.foo and so on.
   * model.reset("nested")
   * ```
   *
   * @param name A fully qualified field name or a partial one using dot notation.
   */
  reset = (name?: string): void => {
    let shouldNotify = true

    if (name) {
      shouldNotify = this._for(name, ({name}) => {
        const fieldSchema = retrieve(this._schema, name)
        if (!fieldSchema) {
          return
        }

        this._registerField(name, fieldSchema)
      })
      this._mem = {}
    } else {
      this._setupInitialState()
      this._options.onReset(this)
    }

    if (shouldNotify) {
      this._notify()
    }
  }

  private _setupInitialState() {
    this._clearState()
    this._setupInitialFieldState()
  }

  private _clearState() {
    this._utils = {}
    this._mem = {}
  }

  private _setupInitialFieldState(name = "") {
    const fieldSchema = retrieve<any>(this._schema, name)

    if (fieldSchema === undefined) {
      return
    }

    if (!isSchemaFieldObject(fieldSchema)) {
      Object.keys(fieldSchema).forEach((k) =>
        this._setupInitialFieldState(name ? `${name}.${k}` : k)
      )
    } else {
      this._registerField(name, fieldSchema)
    }
  }

  private _registerField(name: string, schema: ModelSchemaField) {
    const {value, error, ...utils} = schema
    this._utils[name] = utils

    const field: ModelField = {
      error,
      name,
      value,

      dirty: false,
      initialValue: value,
      reset: () => this.reset(name),
      setValue: (input, shouldValidate) =>
        this.setFieldValue(name, input, shouldValidate),
      touched: false,
      validate: () => this.validateField(name),
    }

    this._fields[name] = field

    if (error) {
      if (!this._mem.errors) {
        this._mem.errors = {}
      }
      this._mem.errors[name] = error
    }
  }

  /**
   * Finds a single field or all fields with names starting with a given part
   * and calls a given callback with each of the matched names.
   *
   * @param search A fully qualified field name or partial field name using dot
   * notation.
   * @param cb An action to perform for each field name
   *
   * @returns Returns `true` if at least one field was found, and therefore the
   * callback executed at least once. Returns `false` otherwise.
   */
  private _for(search: string, cb: (name: ModelField) => void): boolean {
    let fields = Object.values(this._fields)

    const directFieldMatch = this._fields[search]
    if (directFieldMatch) {
      fields = [directFieldMatch]
    } else {
      const dotSearch = search + "."
      fields = fields.filter(({name}) => name.indexOf(dotSearch) === 0)
    }

    fields.forEach(cb)
    return fields.length > 0
  }

  // TODO: Consider using React's useMutableSource hook once it becomes
  // available in place of the subscription based implementation.
  // @see https://github.com/facebook/react/pull/18000
  _subscribe(sub: ModelSubscriber<T>) {
    this._subs.add(sub)
    return () => {
      this._subs.delete(sub)
    }
  }

  private _notify() {
    this._subs.forEach((s) => s(this))
  }
}
