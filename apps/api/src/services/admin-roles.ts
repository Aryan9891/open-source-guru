// The admin role: granted from the admin dashboard, or to ADMIN_LOGINS to create the first admin.
import type { Database } from "@osg/core/db";
import { and, eq, inArray, isNull, sql } from "@osg/core/db/query";
import { type UserRole, users } from "@osg/core/db/schema";
import type { ApiContext } from "../context.ts";
import { ApiError, notFound } from "../errors.ts";
import { findAdminUser } from "./admin-lists.ts";

/** Makes the existing users with these (lowercased) GitHub logins admins. Returns their logins. */
export async function promoteAdminLogins(db: Database, logins: readonly string[]) {
  if (logins.length === 0) return [];
  const promoted = await db
    .update(users)
    .set({ role: "admin" })
    .where(and(inArray(sql`lower(${users.login})`, [...logins]), isNull(users.role)))
    .returning({ login: users.login });
  return promoted.map((user) => user.login);
}

/** Changes another user's role. Admins can't change their own, so one admin always remains. */
export async function setUserRole(
  ctx: ApiContext,
  actorId: string,
  userId: string,
  role: UserRole,
) {
  if (userId === actorId) {
    throw new ApiError(409, "own_role", "You can't change your own role.");
  }
  const [updated] = await ctx.db
    .update(users)
    .set({ role: role === "admin" ? "admin" : null })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  const user = updated && (await findAdminUser(ctx, updated.id));
  if (!user) throw notFound("User");
  return user;
}
