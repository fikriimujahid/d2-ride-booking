import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "../app/page";

describe("web_passenger smoke", () => {
  it("renders landing hero copy", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Get there with RideGo/i)).toBeInTheDocument();
  });
});
