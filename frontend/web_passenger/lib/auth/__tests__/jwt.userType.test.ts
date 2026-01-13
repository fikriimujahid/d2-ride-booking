import { describe, expect, it } from "vitest"
import { getJwtUserType } from "../jwt"

function base64UrlEncodeJson(value: unknown) {
  const json = JSON.stringify(value)
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function makeToken(payload: Record<string, unknown>) {
  const header = base64UrlEncodeJson({ alg: "none", typ: "JWT" })
  const body = base64UrlEncodeJson(payload)
  return `${header}.${body}.sig`
}

describe("getJwtUserType", () => {
  it("reads backend 'role' claim", () => {
    const token = makeToken({ role: "PASSENGER" })
    expect(getJwtUserType(token)).toBe("PASSENGER")
  })

  it("normalizes lowercase role values", () => {
    const token = makeToken({ role: "passenger" })
    expect(getJwtUserType(token)).toBe("PASSENGER")
  })

  it("supports legacy 'ut' claim", () => {
    const token = makeToken({ ut: "PASSENGER" })
    expect(getJwtUserType(token)).toBe("PASSENGER")
  })
})
