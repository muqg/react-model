type FormInputElement =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement

/**
 * Events that can be parsed to extract a value from.
 */
export type ParseableEvent =
  | React.ChangeEvent<FormInputElement>
  | React.FocusEvent<FormInputElement>

/**
 * Parses input value out of a change or focus event. The resulting value is:
 *  - `number` when the event target is an input of type `number|range`
 *  - `boolean` when the event target is an input of type `checkbox`
 *  - `string[]` when the event target is a multiple select
 *  - `string` in any other non-specific case
 *
 * @param event A change or focus event.
 */
export function parseEventInput(event: ParseableEvent) {
  // React events should be presisted for them to not be
  // reused while a change is still being processed.
  // @see https://reactjs.org/docs/events.html#event-pooling
  event.persist()

  const target = (event.target || event.currentTarget) as FormInputElement
  const {type, value} = target

  if (/number|range/.test(type)) {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? value : parsed
  }
  if (type === "checkbox") {
    return (target as HTMLInputElement).checked
  }
  if ("options" in target && target.multiple) {
    return Array.from(target.options)
      .filter(o => o.selected)
      .map(o => o.value)
  }

  return value
}
