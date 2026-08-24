import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthScreen } from "@/features/auth/components/auth-screen";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  refresh.mockReset();
});

describe("AuthScreen", () => {
  it("switches modes and validates controlled inputs", () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "회원가입" }));
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "bad" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "계정 만들기" }));

    expect(screen.getByText("올바른 이메일 주소를 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("비밀번호는 8자 이상이어야 합니다.")).toBeInTheDocument();
  });

  it("submits signup once and navigates on success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "user-id", email: "user@example.test" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "회원가입" }));
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: " User@Example.test " } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "계정 만들기" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "user@example.test", password: "password123" }),
      }),
    );
  });

  it("shows a generic server error without clearing credentials", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "INVALID_CREDENTIALS", message: "이메일 또는 비밀번호가 올바르지 않습니다." } }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );
    render(<AuthScreen />);
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "user@example.test" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이메일 또는 비밀번호가 올바르지 않습니다.");
    expect(screen.getByLabelText("이메일")).toHaveValue("user@example.test");
  });

  it("shows only configured OAuth providers and prevents repeat navigation", () => {
    render(
      <AuthScreen
        enabledOAuthProviders={["google"]}
        oauthError="소셜 로그인이 취소되었습니다."
      />,
    );

    const google = screen.getByRole("link", { name: "Google로 계속" });
    expect(google).toHaveAttribute("href", "/api/auth/oauth/google/start");
    expect(screen.queryByRole("link", { name: "카카오로 계속" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("소셜 로그인이 취소되었습니다.");

    fireEvent.click(google);
    expect(screen.getByRole("link", { name: "이동 중..." })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
