/* eslint-disable @typescript-eslint/no-require-imports */
// Windows sandbox compatibility for Node builds where os.userInfo() fails on
// a Unicode account name. This is only preloaded by local tooling commands.
const os = require("node:os");

try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: "codex-user",
    homedir: process.cwd(),
    shell: null,
  });
}
