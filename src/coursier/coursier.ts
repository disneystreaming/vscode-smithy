import { downloadCoursierIfRequired } from "./download-coursier";
import { findCoursierOnPath } from "./path-check";

export function getCoursierExecutable(extensionPath: string): Promise<string> {
  return findCoursierOnPath(extensionPath).then((paths) => {
    if (paths.length > 0) {
      return paths[0];
    } else {
      return downloadCoursierIfRequired(
        extensionPath,
        process.platform,
        process.arch,
        // Have to use a commit hash for now since the launchers repository is untagged
        "56971135cd9b08eaefed13b4d6b7a95ba9cce572",
        "v2.1.10"
      );
    }
  });
}
