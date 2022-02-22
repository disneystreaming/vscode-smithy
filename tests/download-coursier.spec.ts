import { join } from "path";
import { tmpdir } from "os";
import { existsSync, accessSync, mkdtemp, constants as FS_CONSTANTS } from "fs";
import { getCoursier } from "../src/download-coursier";

test("download cousier's executable to disk", () => {
  return withTempDir().then((dir) => {
    return getCoursier(dir, "v2.0.6").then((path) => {
      expect(existsSync(path)).toBe(true);
      accessSync(path, FS_CONSTANTS.X_OK);
    });
  });
});

function withTempDir(): Promise<string> {
  return new Promise((resolve, reject) => {
    mkdtemp(join(tmpdir(), "test-"), (err, directory) => {
      if (err) reject(err);
      else resolve(directory);
    });
  });
}
