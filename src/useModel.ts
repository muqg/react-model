import {useContext, useEffect, useMemo} from "react"
import {Model} from "./Model"
import {ModelContext} from "./ModelProvider"
import {ModelOptions, ModelSchema} from "./types"
import {isObject} from "./util/ObjectUtils"
import {useForceUpdate} from "./util/useForceUpdate"

/**
 * Access model from context.
 *
 * @throw When calld outside of model context.
 * @see ModelProvider for more information.
 */
export function useModel<T extends object>(): Model<T>
/**
 * Access a model method or property and subscribe to changes to it.
 *
 * @param selector Name of the model method or property.
 */
export function useModel<
  T extends object,
  U extends keyof Model<T> = keyof Model<T>
>(selector: U): Model<T>[U]
/**
 * Create a model instance from schema.
 *
 * @param schema Model object schema.
 * @param options Options for the created model.
 */
export function useModel<T extends object = any>(
  schema: ModelSchema<T>,
  options?: ModelOptions
): Model<T>

export function useModel(
  schemaOrSelector?: ModelSchema | string,
  options: Partial<ModelOptions> = {}
): Model | Model[keyof Model] {
  const contextModel = useContext(ModelContext)

  const model = useMemo<Model>(() => {
    if (isObject<ModelSchema>(schemaOrSelector)) {
      return new Model(schemaOrSelector, options)
    } else {
      return contextModel
    }
  }, [])

  let result: any = model
  if (typeof schemaOrSelector === "string") {
    if (schemaOrSelector.indexOf("_") === -1) {
      result = model[schemaOrSelector]
    } else {
      result = undefined
    }
  }

  // TODO: Consider using React's useMutableSource hook once it becomes
  // available in place of the subscription based implementation.
  // @see https://github.com/facebook/react/pull/18000
  const forceUpdate = useForceUpdate()
  useEffect(() => {
    // Since model methods are always the same it is unnecessary to subscribe
    // at all. They do not need to be updated on model change.
    if (typeof result === "function") {
      return
    }

    return model._subscribe((instance) => {
      // By default it is assumed that the result is the model itself and
      // we would like to update anytime it changes.
      let shouldUpdate = true

      // If the result is a selected model property we only ever want to
      // update when it has actually changed.
      if (typeof schemaOrSelector === "string") {
        shouldUpdate = instance[schemaOrSelector] !== result
      }

      if (shouldUpdate) {
        forceUpdate()
      }
    })
  }, [result, model, schemaOrSelector, forceUpdate])

  return result
}
