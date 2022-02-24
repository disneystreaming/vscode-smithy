import { ExecForCode, findCoursierOnPath } from "../../src/coursier/path-check";

test("empty if exec are all non-zero", () => {
  const fail: ExecForCode = {
    run: () => Promise.resolve(1),
  };

  return findCoursierOnPath(process.cwd(), fail).then((paths) => {
    expect(paths).toHaveLength(0);
  });
});

test("empty if exec fails", () => {
  const fail: ExecForCode = {
    run: () => Promise.reject(new Error("oopsy")),
  };

  return findCoursierOnPath(process.cwd(), fail).then((paths) => {
    expect(paths).toHaveLength(0);
  });
});

test("two executables if exec are zero", () => {
  const fail: ExecForCode = {
    run: () => Promise.resolve(0),
  };

  return findCoursierOnPath(process.cwd(), fail).then((paths) => {
    expect(paths).toStrictEqual(["cs", "coursier"]);
  });
});

test("one executable if one or the other is not found", () => {
  const csExists: ExecForCode = {
    run: (execName) => Promise.resolve(execName === "cs" ? 0 : 1),
  };
  const coursierExists: ExecForCode = {
    run: (execName) => Promise.resolve(execName === "coursier" ? 0 : 1),
  };

  const t1 = findCoursierOnPath(process.cwd(), csExists).then((paths) => {
    expect(paths).toStrictEqual(["cs"]);
  });
  const t2 = findCoursierOnPath(process.cwd(), coursierExists).then((paths) => {
    expect(paths).toStrictEqual(["coursier"]);
  });

  return Promise.all([t1, t2]);
});
