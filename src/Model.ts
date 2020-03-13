import {ParseableEvent, parseEventInput} from "./parseEventInput"
import {
  ModelErrors,
  ModelField,
  ModelFieldsTree,
  ModelOptions,
  ModelSchema,
  ModelSchemaField,
  ModelValidationError,
} from "./types"
import {insert, isObject, retrieve} from "./util/ObjectUtils"

type ModelFieldUtils = Omit<ModelSchemaField, "error" | "value">
type ModelSubscriber<T extends object = any> = (model: Model<T>) => void

type State = {
  dirty?: boolean
  errors?: ModelErrors
  submitted?: boolean
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
const ValidSchemaFieldKeys: Required<ModelSchemaField> = {
  error: true as any,
  parse: true as any,
  value: true as any,
  validate: true as any,
}

function isSchemaFieldObject(input: any): input is ModelSchemaField {
  return (
    isObject(input) && Object.keys(input).some(k => !ValidSchemaFieldKeys[k])
  )
}

function isEventInput(input: any): input is ParseableEvent {
  return isObject(input) && "target" in input && input.target instanceof Element
}

export class Model<T extends object = any> implements Model<T> {
  /**
   * Model's fields shaped like the target object.
   */
  fields = {} as ModelFieldsTree<T>

  /**
   * Model's fields' values shaped like the target object.
   */
  values = {} as T

  private _submitting = false

  /**
   * Current state memory. It stores variables
   * which are cleared on model value change.
   */
  private _mem: State = {}
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
   * Returns a model field using dot notation.
   *
   * @param name Target field name using dot notation.
   */
  getField<T = any>(name: string): ModelField<T> {
    const field = retrieve(this.fields, name)

    if (field === this.fields || field === undefined) {
      throw new Error(
        `Missing model field: ${name}\n` +
          "This field was not part of the initial schema and is possibly an error in your code."
      )
    }

    return field
  }

  private _updateField(
    fieldOrName: ModelField | string,
    changes: Partial<ModelField>
  ): ModelField {
    const field: ModelField | undefined =
      typeof fieldOrName === "string" ? this.getField(fieldOrName) : fieldOrName

    // TODO: Warn for unsupported field values e.g. undefined. They are
    // considered code errors just as is an empty input name.
    if (changes.value !== undefined) {
      this._mem.dirty = true
      field.dirty = true

      this.values = insert(this.values, field.name, changes.value)
    }

    const updated = {...field, ...changes}
    this.fields = insert(this.fields, field.name, updated)

    return updated
  }

  /**
   * Handle a model field change event.
   */
  handleChange = (event: ParseableEvent): void => {
    const key = event.target.name || event.target.id
    this.setFieldValue(key, event)
  }

  /**
   * Set the value of a model field.
   *
   * @param name Target field name using dot notation.
   * @param input Input value.
   */
  setFieldValue(name: string, input: any): void {
    if (!name) {
      // TODO: Consider implementing as a DEV only warning.
      console.warn(
        "Attempting to change a model value for input with no name or id. " +
          "This is possibly an error and you have forgot to give your input a name."
      )
      return
    }

    let field = this.getField(name)

    let value = input
    const {parse} = this._utils[name]

    if (parse) {
      value = parse(input, retrieve(this.values, name), name)
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
    this._performFieldValidation(field)

    this._notify()
    this._options.onChange(this)
  }

  /**
   * Whether a any field's value was changed.
   */
  isDirty(): boolean {
    return !!this._mem.dirty
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

      Object.keys(this._utils).forEach(name => {
        const error = this._performFieldValidation(this.getField(name))
        if (error) {
          errors[name] = error
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
    const error = this._performFieldValidation(this.getField(name))

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

        // Submission should be called before resetting the model in order to
        // allow it to access the model in its submission state.
        this._options.onSubmit(this)
        this.reset()

        // Has to be set to true again due to the reset call above.
        this._mem.submitted = true

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

  private _setSubmitting(value: boolean) {
    this._submitting = value
    this._notify()
  }

  /**
   * Whether the model is currently being submitted.
   */
  isSubmitting(): boolean {
    return this._submitting
  }

  /**
   * Reset model instance to its initial state.
   */
  reset = () => {
    this._setupInitialState()
    this._options.onReset(this)
    this._notify()
  }

  private _setupInitialState() {
    this._clearState()
    this._setupInitialFieldState()
  }

  private _clearState() {
    this.values = {} as any
    this._utils = {}
    this._mem = {}
  }

  private _setupInitialFieldState(name = "") {
    const fieldSchema = retrieve<any>(this._schema, name)

    if (fieldSchema === undefined) {
      return
    }

    if (!Array.isArray(fieldSchema) && isSchemaFieldObject(fieldSchema)) {
      Object.keys(fieldSchema).forEach(k =>
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

      change: input => this.setFieldValue(name, input),
      dirty: false,
      validate: () => this.validateField(name),
    }

    this.fields = insert(this.fields, name, field)
    this.values = insert(this.values, name, value)

    if (error) {
      if (!this._mem.errors) {
        this._mem.errors = {}
      }
      this._mem.errors[name] = error
    }
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
    this._subs.forEach(s => s(this))
  }
}
