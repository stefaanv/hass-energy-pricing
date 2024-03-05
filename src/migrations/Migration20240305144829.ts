import { Migration } from '@mikro-orm/migrations'

export class Migration20240305144829 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `
      CREATE TABLE IF NOT EXISTS "index" (
        "from" datetime NOT NULL PRIMARY KEY,
        "till" datetime NOT NULL,
        "index" float NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `.replaceAll(/"/g, '`'),
    )
  }
}
