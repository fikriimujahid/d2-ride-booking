import { Suspense } from "react"

import LoginClient from "./login-client"

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
          Loading...
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  )
}
