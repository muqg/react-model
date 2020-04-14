import {WebStorage} from "../WebStorage"

describe("WebStorage", () => {
  it("does not throw when localStorage is disabled or unsupported", () => {
    const storage = window.localStorage
    // @ts-ignore
    delete window.localStorage

    jest.resetModules()
    const cache = new WebStorage("test")

    expect(() => cache.load()).not.toThrow()
    expect(() => cache.clear()).not.toThrow()
    expect(() => cache.save({})).not.toThrow()

    // @ts-ignore
    window.localStorage = storage
  })

  it("always returns an object when loading", () => {
    const cache = new WebStorage("string")
    cache.save("test" as any)

    expect(cache.load()).toEqual({})

    cache.save([] as any)

    expect(cache.load()).toEqual({})
  })
})
