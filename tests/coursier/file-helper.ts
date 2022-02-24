import { join } from "path";
import { tmpdir } from "os";
import { mkdtemp } from "fs";

export function withTempDir(): Promise<string> {
  return new Promise((resolve, reject) => {
    mkdtemp(join(tmpdir(), "test-"), (err, directory) => {
      if (err) reject(err);
      else resolve(directory);
    });
  });
}
