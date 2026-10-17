import { eq } from "@osg/core/db/query";
import { users } from "@osg/core/db/schema";
import { describe, expect, it } from "vitest";
import { promoteAdminLogins } from "./services/admin-roles.ts";
import { seedContributions } from "./testing/contributions.ts";
import { createTestApi, useTestDatabase } from "./testing/setup.ts";

const database = useTestDatabase();
const setup = () => createTestApi(database());

describe("admin access", () => {
  it("is hidden from anonymous users, regular users and API keys", async () => {
    const { app, signUp, signUpAdmin } = await setup();
    const anonymous = await app.inject({ method: "GET", url: "/v1/admin/stats" });
    expect(anonymous.statusCode).toBe(401);

    const { cookie } = await signUp("ada");
    const user = await app.inject({ method: "GET", url: "/v1/admin/stats", headers: { cookie } });
    expect(user.statusCode).toBe(404);

    const admin = await signUpAdmin();
    const created = await app.inject({
      method: "POST",
      url: "/v1/me/api-keys",
      headers: { cookie: admin.cookie },
      payload: { name: "script" },
    });
    const withKey = await app.inject({
      method: "GET",
      url: "/v1/admin/stats",
      headers: { authorization: `Bearer ${created.json().key}` },
    });
    expect(withKey.statusCode).toBe(404);
  });

  it("exposes the role on /v1/me", async () => {
    const { app, signUp, signUpAdmin } = await setup();
    const user = await signUp("ada");
    const admin = await signUpAdmin();
    const me = (cookie: string) =>
      app.inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect((await me(user.cookie)).json().role).toBe("user");
    expect((await me(admin.cookie)).json().role).toBe("admin");
  });

  it("promotes ADMIN_LOGINS case-insensitively", async () => {
    const { signUp } = await setup();
    await signUp("Grace");
    await signUp("ada");
    expect(await promoteAdminLogins(database().db, ["grace"])).toEqual(["Grace"]);
    const roles = await database().db.select({ login: users.login, role: users.role }).from(users);
    expect(roles).toEqual(
      expect.arrayContaining([
        { login: "Grace", role: "admin" },
        { login: "ada", role: null },
      ]),
    );
  });
});

describe("admin dashboard data", () => {
  it("counts users, repositories, subscriptions and labels", async () => {
    const { app, signUpAdmin, signUpAndSubscribe } = await setup();
    const { cookie } = await signUpAdmin();
    const ada = await signUpAndSubscribe("ada");
    await app.inject({
      method: "PATCH",
      url: `/v1/me/subscriptions/${ada.subscription.id}`,
      headers: { cookie: ada.cookie },
      payload: { labels: ["Help Wanted", "bug"] },
    });
    const grace = await signUpAndSubscribe("grace");
    await app.inject({
      method: "PATCH",
      url: `/v1/me/subscriptions/${grace.subscription.id}`,
      headers: { cookie: grace.cookie },
      payload: { labels: ["help wanted"] },
    });

    const stats = await app.inject({ method: "GET", url: "/v1/admin/stats", headers: { cookie } });
    expect(stats.statusCode).toBe(200);
    const body = stats.json();
    expect(body.users).toMatchObject({ total: 3, admins: 1, newLast7Days: 3 });
    expect(body.signupsByDay).toHaveLength(30);
    expect(body.signupsByDay.at(-1).count).toBe(3);
    expect(body.subscriptions).toEqual({ total: 2, active: 2 });
    expect(body.topRepositories).toEqual([{ fullName: "acme/repo", subscribers: 2 }]);
    expect(body.topLabels[0]).toEqual({
      name: "help wanted",
      subscriptions: 2,
      users: 2,
      repositories: 1,
    });

    const labels = await app.inject({
      method: "GET",
      url: "/v1/admin/labels?q=bu",
      headers: { cookie },
    });
    expect(labels.json()).toMatchObject({ total: 1, items: [{ name: "bug", subscriptions: 1 }] });

    const repos = await app.inject({
      method: "GET",
      url: "/v1/admin/repositories?q=acme/",
      headers: { cookie },
    });
    expect(repos.json()).toMatchObject({
      total: 1,
      items: [{ fullName: "acme/repo", followers: 2, contributors: 0, status: "active" }],
    });
  });

  it("separates followed repositories from those only known through contributions", async () => {
    const { app, signUpAdmin, signUpAndSubscribe } = await setup();
    const { cookie } = await signUpAdmin();
    const ada = await signUpAndSubscribe("ada");
    await seedContributions(database().db, ada.user.id);
    const list = async (query: string) => {
      const response = await app.inject({
        method: "GET",
        url: `/v1/admin/repositories${query}`,
        headers: { cookie },
      });
      return response.json() as {
        total: number;
        items: { fullName: string; followers: number; contributors: number }[];
      };
    };

    const all = await list("");
    expect(all.total).toBe(4);
    expect(all.items[0]).toMatchObject({ fullName: "acme/repo", followers: 1, contributors: 0 });
    expect(all.items.find((repo) => repo.fullName === "acme/lib")).toMatchObject({
      followers: 0,
      contributors: 1,
    });

    const followed = await list("?source=followed");
    expect(followed.items.map((repo) => repo.fullName)).toEqual(["acme/repo"]);
    const fromContributions = await list("?source=contributions");
    expect(fromContributions.items.map((repo) => repo.fullName).sort()).toEqual([
      "acme/app",
      "acme/lib",
      "ada/dotfiles",
    ]);

    const stats = await app.inject({ method: "GET", url: "/v1/admin/stats", headers: { cookie } });
    expect(stats.json().repositories).toMatchObject({
      total: 4,
      followed: 1,
      fromContributions: 3,
    });
  });
});

describe("admin users", () => {
  it("searches and filters users", async () => {
    const { app, signUp, signUpAdmin } = await setup();
    const { cookie } = await signUpAdmin("root");
    await signUp("ada");
    await signUp("grace");

    const search = await app.inject({
      method: "GET",
      url: "/v1/admin/users?q=GRA",
      headers: { cookie },
    });
    expect(search.json()).toMatchObject({
      total: 1,
      items: [{ login: "grace", role: "user", subscriptions: 0 }],
    });

    const admins = await app.inject({
      method: "GET",
      url: "/v1/admin/users?role=admin",
      headers: { cookie },
    });
    expect(admins.json().items.map((user: { login: string }) => user.login)).toEqual(["root"]);

    // `_` and `%` are matched literally.
    const literal = await app.inject({
      method: "GET",
      url: "/v1/admin/users?q=_",
      headers: { cookie },
    });
    expect(literal.json().total).toBe(0);
  });
});

describe("granting the admin role", () => {
  it("lets admins promote and demote other users", async () => {
    const { app, signUp, signUpAdmin } = await setup();
    const { cookie } = await signUpAdmin();
    const ada = await signUp("ada");

    const promoted = await app.inject({
      method: "PATCH",
      url: `/v1/admin/users/${ada.user.id}`,
      headers: { cookie },
      payload: { role: "admin" },
    });
    expect(promoted.json()).toMatchObject({ login: "ada", role: "admin" });
    const adaStats = await app.inject({
      method: "GET",
      url: "/v1/admin/stats",
      headers: { cookie: ada.cookie },
    });
    expect(adaStats.statusCode).toBe(200);

    const demoted = await app.inject({
      method: "PATCH",
      url: `/v1/admin/users/${ada.user.id}`,
      headers: { cookie },
      payload: { role: "user" },
    });
    expect(demoted.json().role).toBe("user");
  });

  it("refuses changing your own role, unknown users and non-admins", async () => {
    const { app, signUp, signUpAdmin } = await setup();
    const admin = await signUpAdmin();
    const ada = await signUp("ada");

    const own = await app.inject({
      method: "PATCH",
      url: `/v1/admin/users/${admin.user.id}`,
      headers: { cookie: admin.cookie },
      payload: { role: "user" },
    });
    expect(own.statusCode).toBe(409);

    const unknown = await app.inject({
      method: "PATCH",
      url: "/v1/admin/users/00000000-0000-4000-8000-000000000000",
      headers: { cookie: admin.cookie },
      payload: { role: "admin" },
    });
    expect(unknown.statusCode).toBe(404);

    const selfPromotion = await app.inject({
      method: "PATCH",
      url: `/v1/admin/users/${ada.user.id}`,
      headers: { cookie: ada.cookie },
      payload: { role: "admin" },
    });
    expect(selfPromotion.statusCode).toBe(404);
    const [stored] = await database()
      .db.select({ role: users.role })
      .from(users)
      .where(eq(users.id, ada.user.id));
    expect(stored?.role).toBeNull();
  });

  it("can't be set through Better Auth or /v1/me", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp("ada");
    const patch = await app.inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { role: "admin" },
    });
    expect(patch.statusCode).toBe(400);
    const update = await app.inject({
      method: "POST",
      url: "/api/auth/update-user",
      headers: { cookie, origin: "http://localhost:3000" },
      payload: { role: "admin" },
    });
    expect(update.statusCode).toBe(404);
  });
});
