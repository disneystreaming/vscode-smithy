import { downloadCoursierIfRequired } from "../../src/coursier/download-coursier";
import { tmpdir } from "os";
import { existsSync, mkdirSync, accessSync, constants, rmSync } from "fs";
import { join } from "path";

["darwin", "linux", "win32"].forEach((p) => {
  test(
    `download on platform: ${p}`,
    () => {
      const dir = join(tmpdir(), p);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      return downloadCoursierIfRequired(dir, p, "v2.0.13").then((x) => {
        expect(existsSync(x)).toBeTruthy();
        accessSync(x, constants.X_OK);
      });
    },
    25 * 1000
  );
});

test(`fails on unknown platform`, () => {
  return expect(
    downloadCoursierIfRequired(tmpdir(), "unsupported", "v2.0.13")
  ).rejects.toEqual("Unsupported platform unsupported.");
});
