import * as path from "path";
import { https } from "follow-redirects";
import { IncomingMessage } from "http";
import * as fs from "fs";
import { access, mkdir } from "fs/promises";
import * as zlib from "zlib";

export function downloadCoursierIfRequired(
  extensionPath: string,
  platform: string,
  arch: String,
  versionPath: string,
  versionPathArm64: String
): Promise<string> {
  function binPath(filename: string) {
    return path.join(extensionPath, filename);
  }

  function createDir() {
    return mkdir(extensionPath).catch((err: { code?: string }) => {
      return err && err.code === "EEXIST"
        ? Promise.resolve()
        : Promise.reject(err);
    });
  }

  const supportedTargets = {
    darwin: {
      url: `https://github.com/coursier/launchers/raw/${versionPath}/cs-x86_64-apple-darwin.gz`,
      bin: binPath("coursier"),
    },
    linux: {
      url: `https://github.com/coursier/launchers/raw/${versionPath}/cs-x86_64-pc-linux.gz`,
      bin: binPath("coursier"),
    },
    win32: {
      url: `https://github.com/coursier/launchers/raw/${versionPath}/cs-x86_64-pc-win32.zip`,
      bin: binPath("coursier.exe"),
    },
  };

  const supportedTargetsArm64 = {
    darwin: {
      url: `https://github.com/VirtusLab/coursier-m1/releases/download/${versionPathArm64}/cs-aarch64-apple-darwin.gz`,
      bin: binPath("coursier"),
    },
    linux: {
      url: `https://github.com/VirtusLab/coursier-m1/releases/download/${versionPathArm64}/cs-aarch64-pc-linux.gz`,
      bin: binPath("coursier"),
    },
  };

  const target =
    arch === "arm64"
      ? supportedTargetsArm64[platform]
      : supportedTargets[platform];
  if (target === undefined) {
    return Promise.reject(`Unsupported platform ${platform}.`);
  } else {
    const targetFile = target.bin;
    return validBinFileExists(targetFile).then((valid) => {
      return valid
        ? targetFile
        : createDir().then(() => downloadFile(target.url, targetFile));
    });
  }
}

function validBinFileExists(file: string): Promise<boolean> {
  return access(file, fs.constants.X_OK)
    .then(() => true)
    .catch(() => false);
}

function downloadFile(url: string, targetFile: string): Promise<string> {
  function promiseGet(url: string): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode === 200) {
          resolve(response);
        } else {
          reject(
            new Error(
              `Server responded with ${response.statusCode}: ${response.statusMessage}`
            )
          );
        }
      });
    });
  }

  function writeToDisk(response: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(targetFile, {
        flags: "wx",
        mode: 0o755,
      });
      response.pipe(zlib.createUnzip()).pipe(file);

      file.on("finish", () => {
        console.log(`Finished downloaded file at ${targetFile}`);
        resolve(targetFile);
      });

      file.on("error", (err: { code: string | undefined }) => {
        if (file) {
          file.close();
          fs.unlink(targetFile, () => {}); // Delete temp file
        }

        if (err.code === "EEXIST") {
          console.log(`File already exists at ${targetFile}`);
          resolve(targetFile);
        } else {
          console.error(`File error while downloading file at ${targetFile}`);
          console.error(err);
          reject(err);
        }
      });
    });
  }
  // adapted from https://stackoverflow.com/a/45007624
  return promiseGet(url).then((resp) => writeToDisk(resp));
}
