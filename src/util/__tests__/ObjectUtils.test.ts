import {insert, retrieve} from "../ObjectUtils"

describe("retrieve function", () => {
  it("returns input object on empty key", () => {
    const obj = {foo: 12, bar: "test"}

    expect(retrieve(obj, "")).toBe(obj)
  })

  it("returns value at target key", () => {
    const obj = {nested: {foo: {value: "test"}}}

    expect(retrieve(obj, "nested.foo.value")).toBe("test")
  })

  it("returns undefined on missing value at target key", () => {
    expect(retrieve({}, "invalid.key")).toBeUndefined()
  })
})

describe("insert function", () => {
  it("returns the input object on empty key", () => {
    const obj = {test: 12, test2: "123"}

    expect(insert(obj, "", "test value")).toEqual(obj)
  })

  it("works when no value exists at target key", () => {
    const obj = {}

    expect(insert(obj, "test.path", "test value")).toEqual({
      test: {path: "test value"},
    })
  })

  it("replaces existing value at target key", () => {
    const obj = {test: 123}

    expect(insert(obj, "test", 42)).toEqual({test: 42})
  })

  it("works through arrays", () => {
    const obj = {items: [{test: 123}]}

    expect(insert(obj, "items.0.test", 42)).toEqual({items: [{test: 42}]})
  })
})
