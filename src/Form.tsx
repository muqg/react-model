import React from "react"
import {ModelProvider} from "./ModelProvider"
import {ModelErrors, ModelOptions, ModelSchema} from "./types"
import {useModel} from "./useModel"

type ProviderProps<T extends object> = {
  /**
   * Model schema.
   */
  schema: ModelSchema<T>
  /**
   * Model options.
   */
  options?: Partial<ModelOptions<T>>
} & React.HTMLProps<HTMLFormElement>

type FormProps<T extends object> = {
  /**
   * Called instead of the submit callback whenever the model
   * has an error.
   *
   * @param errors Model's validation errors.
   */
  handleError?: (errors: ModelErrors) => void
  /**
   * Whether to automatically reset model when the form is successfully
   * submitted.
   *
   * @default false
   */
  resetOnSubmit?: boolean
  /**
   * Called when the model is submitted.
   *
   * @param values Model's values in the shape of the generic target object.
   */
  submit?: (values: T) => void | Promise<void>
} & React.HTMLProps<HTMLFormElement>

const noop: () => any = () => {}

function FormWithContext<T extends object = any>({
  children,
  handleError,
  onReset = noop,
  onSubmit = noop,
  resetOnSubmit,
  submit = noop,
  ...props
}: FormProps<T>) {
  const model = useModel<T>()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(event)

    await model.submit(submit, handleError)

    if (resetOnSubmit) {
      model.reset()
    }
  }

  function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onReset(event)
    model.reset()
  }

  return (
    <form {...props} onReset={handleReset} onSubmit={handleSubmit}>
      {children}
    </form>
  )
}

/**
 * A tiny wrapper around HTML `<form />` element, which provides a model
 * context to its children and sets up form submission and reset, optimized
 * for performance and simplicity of use.
 */
export function Form<T extends object = any>({
  schema,
  options,
  ...props
}: ProviderProps<T> & FormProps<T>) {
  return (
    <ModelProvider {...options} schema={schema}>
      <FormWithContext {...props} />
    </ModelProvider>
  )
}
