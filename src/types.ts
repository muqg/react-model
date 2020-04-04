import type {Model as ModelObject} from "./Model"

export type Model<T extends object = any> = Readonly<ModelObject<T>>

type JsonPrimitive = string | number | boolean | null | undefined

export type ModelValidationError = string | undefined

export type ModelErrors = Record<string, ModelValidationError>

export type ModelOptions<T extends object = any> = {
  /**
   * Called any time a model value changes.
   */
  onChange: (model: Model<T>) => void

  /**
   * Called any time the model resets.
   */
  onReset: (model: Model<T>) => void

  /**
   * Called when the model submits successfully.
   */
  onSubmit: (model: Model<T>) => void

  /**
   * Called when model is validated and allows for additional
   * and more specific validation to be performed.
   */
  validate: (values: T, errors: ModelErrors) => ModelErrors
}

export type ModelField<T = any> = {
  /**
   * Whether the value of the field has been changed.
   */
  dirty: boolean
  /**
   * Current field error message if any.
   */
  error: ModelValidationError
  /**
   * The value that the field was initially set to.
   */
  initialValue: T
  /**
   * Name of the field.
   */
  name: string
  /**
   * Reset field to its initial state.
   */
  reset(): void
  /**
   * Set field value.
   *
   * @param input Input for the value change. Input is passed through the
   * default or custom schema parser, and can therefore be any value supported
   * by it.
   * @param shouldValidate Whether the value should be validated. By default
   * this is enabled and the newly set value is validated.
   */
  setValue(input: any, shouldValidate?: boolean): void
  /**
   * Whether the field was changed, validated or otherwise modified
   * since its initialization or the last time it was reset.
   */
  touched: boolean
  /**
   * Validate field.
   */
  validate(): ModelValidationError
  /**
   * Current field value.
   */
  value: T
}

export type ModelSchema<
  T extends object = any,
  O extends Required<T> = Required<T>
> = {
  [K in keyof O]: O[K] extends JsonPrimitive | Array<any>
    ? ModelSchemaField<O, O[K]>
    : O[K] extends object
    ? ModelSchema<O[K]>
    : never
}

export type ModelSchemaField<
  O extends object = any,
  T extends JsonPrimitive | any[] = any
> = {
  /**
   * Initial field error.
   */
  error?: ModelValidationError
  /**
   * A custom function to derive field's value from incoming input and override
   * the default parser.
   */
  parse?: ModelSchemaFieldParser<T>
  /**
   * Callback to validate the value.
   */
  validate?: ModelSchemaFieldValidator<T, O>
  /**
   * Initial field value.
   */
  value: T
}

export type ModelSchemaFieldParser<T = any> = (
  inputValue: any,
  currentValue: T,
  name: string
) => T

export type ModelSchemaFieldValidator<T = any, O extends object = any> = (
  value: T,
  modelValues: O
) => ModelValidationError
