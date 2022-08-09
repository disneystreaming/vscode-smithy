import { getCoursierExecutable } from "../../src/coursier/coursier";
import { join } from "path";

const tmpdir = process.cwd();

jest.mock("../../src/coursier/path-check", () => ({
  findCoursierOnPath: jest.fn(),
}));

jest.mock("../../src/coursier/download-coursier", () => ({
  downloadCoursierIfRequired: jest.fn(() =>
    Promise.resolve(join(tmpdir, "coursier"))
  ),
}));

function mockfindCoursierOnPath(f: () => Promise<Array<String>>) {
  const pathCheck = require("../../src/coursier/path-check");
  pathCheck.findCoursierOnPath.mockImplementation(f);
}

test("use cs from the path if available", () => {
  mockfindCoursierOnPath(() => Promise.resolve(["cs"]));

  return getCoursierExecutable(tmpdir).then((path) => {
    expect(path).toStrictEqual("cs");
  });
});

test("use coursier from the path if available", () => {
  mockfindCoursierOnPath(() => Promise.resolve(["coursier"]));

  return getCoursierExecutable(tmpdir).then((path) => {
    expect(path).toStrictEqual("coursier");
  });
});

test("download executable if path not found", () => {
  mockfindCoursierOnPath(() => Promise.resolve([]));

  return getCoursierExecutable(tmpdir).then((path) => {
    expect(path).toStrictEqual(join(tmpdir, "coursier"));
  });
});

function mockDownloadCoursierIfRequired(f: () => Promise<Array<String>>) {
  const downloadCoursier = require("../../src/coursier/download-coursier");
  downloadCoursier.downloadCoursierIfRequired.mockImplementation(f);
}

test("download fails returns a rejected promise", () => {
  mockfindCoursierOnPath(() => Promise.resolve([]));
  mockDownloadCoursierIfRequired(() =>
    Promise.reject(new Error("Download failed."))
  );

  return getCoursierExecutable(tmpdir)
    .then(() => fail("Expected the promise to fail."))
    .catch((err) => expect(err.message).toStrictEqual("Download failed."));
});
