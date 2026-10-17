import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { currentUser, requireAdmin } from "../plugins/authenticate.ts";
import {
  adminLabelsResponse,
  adminRepositoriesQuery,
  adminRepositoriesResponse,
  adminUserResponse,
  adminUsersQuery,
  adminUsersResponse,
  followedLabels,
  listQuery,
  listRepositories,
  listUsers,
  userRole,
} from "../services/admin-lists.ts";
import { setUserRole } from "../services/admin-roles.ts";
import { adminStatsResponse, computeAdminStats } from "../services/admin-stats.ts";

/**
 * The admin dashboard's endpoints. Admin sessions only (no API keys); everyone else gets a 404.
 * Hidden from the public API reference.
 */
export const adminRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const preHandler = requireAdmin(ctx);
    const hide = true;

    app.get(
      "/v1/admin/stats",
      { preHandler, schema: { hide, response: { 200: adminStatsResponse } } },
      async () => computeAdminStats(ctx),
    );

    app.get(
      "/v1/admin/users",
      {
        preHandler,
        schema: { hide, querystring: adminUsersQuery, response: { 200: adminUsersResponse } },
      },
      async (request) => listUsers(ctx, request.query),
    );

    app.patch(
      "/v1/admin/users/:id",
      {
        preHandler,
        schema: {
          hide,
          params: z.object({ id: z.uuid() }),
          body: z.object({ role: userRole }).strict(),
          response: { 200: adminUserResponse },
        },
      },
      async (request) => {
        const actor = currentUser(request);
        const user = await setUserRole(ctx, actor.id, request.params.id, request.body.role);
        request.log.info(
          { actor: actor.login, user: user.login, role: user.role },
          "user role changed",
        );
        return user;
      },
    );

    app.get(
      "/v1/admin/repositories",
      {
        preHandler,
        schema: {
          hide,
          querystring: adminRepositoriesQuery,
          response: { 200: adminRepositoriesResponse },
        },
      },
      async (request) => listRepositories(ctx, request.query),
    );

    app.get(
      "/v1/admin/labels",
      {
        preHandler,
        schema: { hide, querystring: listQuery, response: { 200: adminLabelsResponse } },
      },
      async (request) => followedLabels(ctx, request.query),
    );
  };
