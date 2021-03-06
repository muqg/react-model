import {useContext, useDebugValue, useEffect} from "react"
import {ModelContext} from "./ModelProvider"
import {ModelField} from "./types"
import {useForceUpdate} from "./util/useForceUpdate"

const noop: () => any = () => {}

const EmptyField: ModelField = {
  dirty: false,
  error: undefined,
  initialValue: "",
  name: "",
  reset: noop,
  setValue: noop,
  touched: false,
  validate: noop,
  value: "",
}

/**
 * Access a field from context model and subscribe to changes. Hook will update
 * only when the field it is subscribed to changes, meaning that it will not
 * cause a render when another field changes, but this one remains unaffected.
 *
 * @param name Field name using dot notation.
 * @throws When called outside of model context or when the field's name is not
 * a valid model field name, except when it is an empty string.
 */
export function useField<T = any>(name: string = ""): ModelField<T> {
  useDebugValue(name)

  const model = useContext(ModelContext)

  // An empty field should be returned in cases where the name is an empty
  // string. This allows inputs to work in an uncontrolled, headless manner
  // for testing and design preview purposes, before they are actually
  // given names and linked to the model context.
  let field: ModelField
  try {
    field = model.getField(name)
  } catch (err) {
    if (name === "") {
      field = EmptyField
    } else {
      throw err
    }
  }

  // TODO: Consider using React's useMutableSource hook once it becomes
  // available in place of the subscription based implementation.
  // @see https://github.com/facebook/react/pull/18000
  const forceUpdate = useForceUpdate()
  useEffect(() => {
    return model._subscribe((currentModel) => {
      // Component should be subscribed to changes only to
      // the field identified by the name argument.
      if (field !== currentModel.getField(name)) {
        forceUpdate()
      }
    })
  }, [model, field, name, forceUpdate])

  return field
}
