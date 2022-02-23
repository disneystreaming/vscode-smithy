import { accessSync, statSync, constants as FS_CONSTANTS } from "fs";
import { downloadCoursierIfRequired } from "../../src/coursier/download-coursier";
import { withTempDir } from "./file-helper";

test("download once cousier's executable to disk", () => {
  return withTempDir().then((dir) => {
    const t1 = downloadCoursierIfRequired(dir, "v2.0.6").then((path) => {
      accessSync(path, FS_CONSTANTS.X_OK);
      return statSync(path);
    });

    const t2 = t1.then((prevStats) => {
      downloadCoursierIfRequired(dir, "v2.0.6").then((path) => {
        const newStat = statSync(path);
        expect(newStat).toStrictEqual(prevStats);
      });
    });
    return t2;
  });
});
