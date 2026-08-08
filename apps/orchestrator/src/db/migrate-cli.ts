import { migrate } from "./migrate";

migrate()
  .then((applied) => {
    console.log(
      applied.length === 0
        ? "no pending migrations"
        : `applied: ${applied.join(", ")}`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
