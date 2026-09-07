import { OPS } from "../web/language.js";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  writeFileSync,
} from "node:fs";
writeFileSync(
  "src/opcodes.h",
  "// Generated from web/language.js by scripts/build.mjs.\nstatic const char *ARG_TYPES[]={" +
    OPS.map((o) => JSON.stringify(o[1].replaceAll(" ", ""))).join(",") +
    "};\n",
);
const clang =
  process.env.CLANG ||
  (existsSync("/opt/homebrew/opt/llvm/bin/clang")
    ? "/opt/homebrew/opt/llvm/bin/clang"
    : "clang");
const linker =
  process.env.WASM_LD ||
  (existsSync("/opt/homebrew/opt/lld/bin/wasm-ld")
    ? "/opt/homebrew/opt/lld/bin/wasm-ld"
    : null);
const args = [
  "--target=wasm32",
  "-O3",
  "-nostdlib",
  "-fno-builtin",
  "-fvisibility=hidden",
  "src/engine.c",
  "-o",
  "web/engine.wasm",
  "-Wl,--no-entry",
  "-Wl,--export-dynamic",
  "-Wl,--export-memory",
  "-Wl,--initial-memory=33554432",
  "-Wl,--max-memory=33554432",
  "-Wl,-z,stack-size=1048576",
];
if (linker) args.push(`-fuse-ld=${linker}`);
const result = spawnSync(clang, args, { stdio: "inherit" });
if (result.status !== 0) {
  console.error(
    "Install clang and lld (macOS: brew install llvm lld; Ubuntu: apt install clang lld), or set CLANG and WASM_LD.",
  );
  process.exit(1);
}
mkdirSync("dist", { recursive: true });
cpSync("web", "dist", { recursive: true });
copyFileSync("index.html", "dist/index.html");
console.log("Built web/engine.wasm and static dist/.");
