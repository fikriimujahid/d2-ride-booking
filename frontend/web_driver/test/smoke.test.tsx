import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "../app/page";

describe("web_driver smoke", () => {
  it("renders landing hero copy", () => {
    render(<Home />);
    expect(screen.getByText(/Earn More with Every Ride/i)).toBeInTheDocument();
  });
});
