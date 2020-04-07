import React, {createContext, useEffect, useMemo} from "react"
import {Model} from "./Model"
import {ModelOptions, ModelSchema} from "./types"

type Props<T extends object> = {
  children: React.ReactNode
  /**
   * Model object schema.
   */
  schema: ModelSchema<T>
} & Partial<ModelOptions<T>>

export const ModelContext = createContext(new Model<any>({}, {}))

/**
 * Creates a model instance and provides it to its children via context.
 */
export function ModelProvider<T extends object = any>({
  children,
  schema,
  ...options
}: Props<T>) {
  const model = useMemo(() => new Model(schema, options), [])

  useEffect(() => {
    // @ts-ignore
    model._options = {...model._options, ...options}
  })

  return (
    <ModelContext.Provider value={model as any}>
      {children}
    </ModelContext.Provider>
  )
}
