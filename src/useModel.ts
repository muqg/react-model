import {Model} from "./Model"
import {useContext, useEffect, useMemo} from "react"
import {ModelContext} from "./ModelProvider"
import {ModelOptions, ModelSchema} from "./types"
import {useForceUpdate} from "./util/useForceUpdate"

function assertContextModel(maybeModel: any): asserts maybeModel {
  if (!maybeModel) {
    throw new Error(
      "useModel hook can only be called with no arguments in children of " +
        "<ModelProvider />, otherwise you should provide it with an object schema."
    )
  }
  return maybeModel
}

/**
 * Access model from context.
 *
 * @throw When calld outside of model context.
 * @see ModelProvider for more information.
 */
export function useModel<T extends object>(): Model<T>
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

export function useModel<T extends object = any>(
  schema?: ModelSchema<T>,
  options: Partial<ModelOptions<T>> = {}
): Model<T> {
  const maybeContextModel = useContext(ModelContext) as Model<T> | null

  const model = useMemo<Model<T>>(() => {
    if (schema) {
      return new Model<T>(schema, options)
    } else {
      assertContextModel(maybeContextModel)
      return maybeContextModel
    }
  }, [])

  // TODO: Consider using React's useMutableSource hook once it becomes
  // available in place of the subscription based implementation.
  // @see https://github.com/facebook/react/pull/18000
  const forceUpdate = useForceUpdate()
  useEffect(() => model._subscribe(forceUpdate), [forceUpdate, model])

  return model
}
