import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export async function writeOutput(
  cwd: string,
  out: string | undefined,
  content: string,
): Promise<void> {
  if (out === undefined) {
    process.stdout.write(content);
    return;
  }
  const target = resolve(cwd, out);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}
