import type {Model as ModelObject} from "./Model"

export type Model<T extends object = any> = Readonly<ModelObject<T>>

type JsonPrimitive = string | number | boolean | null

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

export type ModelFieldsTree<T extends object = any> = Required<
  {
    [K in keyof T]: T[K] extends JsonPrimitive
      ? ModelField<T[K]>
      : T[K] extends object
      ? T[K] extends Array<any>
        ? ModelField<T[K]>
        : ModelFieldsTree<T[K]>
      : never
  }
>

export type ModelField<T = any> = {
  /**
   * Change field value.
   *
   * @param input Input for the value change.
   * @param shouldValidate Whether the value should be validated. Enabled
   * by default.
   */
  change(input: any, shouldValidate?: boolean): void
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
    : O[K] extends object ? ModelSchema<O[K]> : never
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
