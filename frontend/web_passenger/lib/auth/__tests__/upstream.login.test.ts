import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { passengerLogin } from "../upstream"

describe("web_passenger auth upstream", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("calls /api/v1/passenger/auth/login with {email,password}", async () => {
    process.env.AUTH_API_BASE_URL = "http://localhost:3000"

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })
    globalThis.fetch = fetchMock

    await passengerLogin({ email: "p@example.com", password: "password123" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe("http://localhost:3000/api/v1/passenger/auth/login")
    expect(init?.method).toBe("POST")
    expect(init?.headers).toEqual({ "content-type": "application/json" })
    expect(init?.body).toBe(JSON.stringify({ email: "p@example.com", password: "password123" }))
  })

  it("does not double-prefix when AUTH_API_BASE_URL already ends with /api/v1", async () => {
    process.env.AUTH_API_BASE_URL = "http://localhost:3000/api/v1"

    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ accessToken: "at", refreshToken: "rt", expiresAt: "2026-01-01T00:00:00.000Z" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })
    globalThis.fetch = fetchMock

    await passengerLogin({ email: "p@example.com", password: "password123" })

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toBe("http://localhost:3000/api/v1/passenger/auth/login")
  })

  it("parses nested backend error envelope", async () => {
    process.env.AUTH_API_BASE_URL = "http://localhost:3000"

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    })
    globalThis.fetch = fetchMock

    const { res, payload } = await passengerLogin({ email: "p@example.com", password: "password123" })

    expect(res.ok).toBe(false)
    expect(
      typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof (payload as { error?: unknown }).error === "object" &&
        (payload as { error?: { message?: unknown } }).error !== null
        ? (payload as { error: { message?: unknown } }).error.message
        : undefined
    ).toBe("Invalid email or password")
  })
})
