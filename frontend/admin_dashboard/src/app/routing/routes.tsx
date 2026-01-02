import type React from "react";
import { LoginScreen } from "../components/auth/LoginScreen";
import { MfaEnrollmentFlow } from "../components/auth/MfaEnrollmentFlow";
import { ForbiddenPage } from "../components/auth/ForbiddenPage";
import { AdminShell } from "../components/layout/AdminShell";

/**
 * Route Type Definition
 *
 * This app intentionally uses a tiny custom router (no React Router).
 * The goal is beginner readability and explicit auth/MFA control flow.
 *
 * Properties:
 * - path: URL pathname to match (querystring is ignored for matching)
 * - component: Component to render
 * - requiresAuth: User must be signed in (and have ADMIN system role)
 * - requiresMfa: User must have MFA satisfied before seeing the route
 */
export type Route = {
  path: string;
  component: React.ComponentType<any>;
  requiresAuth?: boolean;
  requiresMfa?: boolean;
};

/**
 * Application Routes Configuration
 *
 * Clear separation:
 * - Public: /login
 * - MFA required: /mfa/setup
 * - Authenticated admin: /app
 * - Authenticated forbidden: /forbidden
 */
export const routes: Route[] = [
  { path: "/", component: LoginScreen, requiresAuth: false },
  { path: "/login", component: LoginScreen, requiresAuth: false },
  { path: "/mfa/setup", component: MfaEnrollmentFlow, requiresAuth: true },
  { path: "/forbidden", component: ForbiddenPage, requiresAuth: true },
  { path: "/app", component: AdminShell, requiresAuth: true, requiresMfa: true },
];
