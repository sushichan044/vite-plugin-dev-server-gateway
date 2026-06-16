import { describe, expect, it } from "vite-plus/test";

import { detectShell } from "./detect-shell";

describe("detectShell", () => {
  it("detects zsh from a SHELL path", () => {
    expect(detectShell({ SHELL: "/bin/zsh" })).toBe("zsh");
  });

  it("detects bash from a SHELL path", () => {
    expect(detectShell({ SHELL: "/usr/local/bin/bash" })).toBe("bash");
  });

  it("detects fish from a SHELL path", () => {
    expect(detectShell({ SHELL: "/opt/homebrew/bin/fish" })).toBe("fish");
  });

  it("detects powershell from a pwsh path", () => {
    expect(detectShell({ ComSpec: "C:\\Program Files\\PowerShell\\7\\pwsh.exe" })).toBe(
      "powershell",
    );
  });

  it("prefers npm_config_script_shell over SHELL", () => {
    expect(detectShell({ npm_config_script_shell: "/bin/bash", SHELL: "/bin/zsh" })).toBe("bash");
  });

  it("falls through to SHELL when npm_config_script_shell names an unsupported shell", () => {
    expect(detectShell({ npm_config_script_shell: "/bin/sh", SHELL: "/bin/zsh" })).toBe("zsh");
  });

  it("returns undefined when only an unsupported shell is named", () => {
    expect(detectShell({ ComSpec: "C:\\Windows\\system32\\cmd.exe" })).toBeUndefined();
  });

  it("returns undefined when no relevant env vars are set", () => {
    expect(detectShell({})).toBeUndefined();
  });
});
