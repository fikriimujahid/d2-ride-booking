type TokenResponse = {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

function authBaseUrl() {
  return process.env.AUTH_API_BASE_URL ?? "http://localhost:3000"
}

export async function passengerLogin(input: { identifier: string; password: string }) {
  const res = await fetch(`${authBaseUrl()}/passenger/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })

  const payload = (await res.json().catch(() => undefined)) as TokenResponse | { message?: string } | undefined
  return { res, payload }
}

export async function passengerRefresh(input: { refreshToken: string }) {
  const res = await fetch(`${authBaseUrl()}/passenger/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })

  const payload = (await res.json().catch(() => undefined)) as TokenResponse | { message?: string } | undefined
  return { res, payload }
}

export async function passengerLogout(input: { refreshToken: string }) {
  const res = await fetch(`${authBaseUrl()}/passenger/auth/logout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => null)

  return res
}
