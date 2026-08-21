import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthenticatedHome } from "@/features/auth/components/authenticated-home";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("AuthenticatedHome", () => {
  it("renders the authenticated user shell and logout", () => {
    render(
      <AuthenticatedHome
        user={{ id: "0c30f756-c61a-4f99-a44a-66b99598ac6a", email: "user@example.test" }}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("내 마인드맵");
    expect(screen.getByText("user@example.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });
});
