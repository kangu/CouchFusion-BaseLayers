import { defineEventHandler } from "h3";
import { getAllDocs } from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { readEmployeeFullName } from "#maintenance/utils/employee-display";

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin"]);

  const config = useRuntimeConfig();
  const dbLoginPrefix = config.dbLoginPrefix;

  const result = await getAllDocs("_users", {
    startkey: `org.couchdb.user:${dbLoginPrefix}`,
    endkey: `org.couchdb.user:${dbLoginPrefix}\ufff0`,
    include_docs: true,
  });

  const employees = result.rows
    .filter((row) => row.doc)
    .map((row) => row.doc as Record<string, unknown>)
    .filter((doc): doc is Record<string, unknown> => {
      if (!doc || !doc.name) return false;
      const name = String(doc.name);
      const roles = Array.isArray(doc.roles) ? doc.roles : [];
      return name.startsWith(dbLoginPrefix) && roles.includes("employee");
    })
    .map((doc) => ({
      name: String(doc.name),
      email: doc.email ?? null,
      fullName: readEmployeeFullName(doc),
      roles: doc.roles ?? [],
    }));

  return {
    employees,
    total: employees.length,
  };
});
