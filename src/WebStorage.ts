import {ModelStorage} from "./types"
import {isObject} from "./util/ObjectUtils"

/**
 * A model storage driver for the web. It uses `localStorage` internally.
 */
export class WebStorage implements ModelStorage {
  private _key: string

  constructor(key: string) {
    this._key = `model-web-storage@${key}`
  }

  load(): object {
    let result
    try {
      result = JSON.parse(localStorage.getItem(this._key) || "")
    } catch {
      /**
       * Not necessary to do anything, this is just to avoid unnecessary
       * exceptions when localStorage is disabled or not supported for some
       * reason.
       */
    }

    return isObject(result) && !Array.isArray(result) ? result : {}
  }

  save(data: object): void {
    try {
      localStorage.setItem(this._key, JSON.stringify(data))
    } catch {
      /**
       * Not necessary to do anything, this is just to avoid unnecessary
       * exceptions when localStorage is disabled or not supported for some
       * reason.
       */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this._key)
    } catch {
      /**
       * Not necessary to do anything, this is just to avoid unnecessary
       * exceptions when localStorage is disabled or not supported for some
       * reason.
       */
    }
  }
}
