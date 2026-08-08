import { describe, expect, it } from "@jest/globals";
import { pendingMigrations } from "./migrator";

describe("pendingMigrations", () => {
  it("returns every migration when none have been applied", () => {
    expect(pendingMigrations(["0001_b.sql", "0000_a.sql"], [])).toEqual([
      "0000_a.sql",
      "0001_b.sql",
    ]);
  });

  it("orders lexically, not by directory listing order", () => {
    const available = ["0010_j.sql", "0002_c.sql", "0001_b.sql"];
    expect(pendingMigrations(available, [])).toEqual([
      "0001_b.sql",
      "0002_c.sql",
      "0010_j.sql",
    ]);
  });

  it("skips migrations already applied", () => {
    const available = ["0000_a.sql", "0001_b.sql", "0002_c.sql"];
    expect(pendingMigrations(available, ["0000_a.sql", "0001_b.sql"])).toEqual([
      "0002_c.sql",
    ]);
  });

  it("ignores non-sql files in the directory", () => {
    const available = ["0000_a.sql", "README.md", "snapshot.json"];
    expect(pendingMigrations(available, [])).toEqual(["0000_a.sql"]);
  });

  it("returns nothing when everything is applied", () => {
    expect(pendingMigrations(["0000_a.sql"], ["0000_a.sql"])).toEqual([]);
  });
});
