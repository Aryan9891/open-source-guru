import { deliveries, events, repositories } from "@osg/core/db/schema";
import { one } from "@osg/core/testing";
import { describe, expect, it } from "vitest";
import { createTestApi, useTestDatabase } from "./testing/setup.ts";

const database = useTestDatabase();
const setup = () => createTestApi(database());

describe("subscriptions", () => {
  it("creates a subscription from a GitHub URL, using the primary email by default", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp();

    const created = await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie },
      payload: { repo: "https://github.com/ACME/repo", labels: ["help wanted", "help wanted"] },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      repo: { fullName: "acme/repo", url: "https://github.com/acme/repo" },
      labels: ["help wanted"],
      events: ["issue.opened", "issue.labeled"],
      labelMatch: "any",
      status: "active",
      channels: [{ frequency: "instant" }],
    });
    expect(await database().db.select().from(repositories)).toMatchObject([
      { githubId: 99, owner: "acme", name: "repo" },
    ]);
  });

  it("refuses unknown and private repositories", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp();

    for (const repo of ["acme/nope", "acme/secret"]) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/subscriptions",
        headers: { cookie },
        payload: { repo },
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe("repository_not_found");
    }
    const invalid = await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie },
      payload: { repo: "not a repo" },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("updates, pauses and deletes subscriptions; users can't touch others' subscriptions", async () => {
    const { app, signUp } = await setup();
    const ada = await signUp("ada");
    const bob = await signUp("bob");

    const created = await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie: ada.cookie },
      payload: { repo: "acme/repo", labels: ["bug"] },
    });
    const { id, channels } = created.json();

    const updated = await app.inject({
      method: "PATCH",
      url: `/v1/me/subscriptions/${id}`,
      headers: { cookie: ada.cookie },
      payload: {
        labels: ["good first issue"],
        status: "paused",
        channels: [{ channelId: channels[0].channelId, frequency: "daily" }],
      },
    });
    expect(updated.json()).toMatchObject({
      labels: ["good first issue"],
      status: "paused",
      channels: [{ frequency: "daily" }],
    });

    const other = await app.inject({
      method: "DELETE",
      url: `/v1/me/subscriptions/${id}`,
      headers: { cookie: bob.cookie },
    });
    expect(other.statusCode).toBe(404);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/v1/me/subscriptions/${id}`,
      headers: { cookie: ada.cookie },
    });
    expect(deleted.statusCode).toBe(204);
    const list = await app.inject({
      method: "GET",
      url: "/v1/me/subscriptions",
      headers: { cookie: ada.cookie },
    });
    expect(list.json()).toEqual([]);
  });
});

describe("repositories and feed", () => {
  it("lists labels by number of open issues, cached", async () => {
    const { app, github } = await setup();

    const first = await app.inject({ method: "GET", url: "/v1/public/repos/acme/repo/labels" });
    const second = await app.inject({ method: "GET", url: "/v1/public/repos/acme/repo/labels" });

    expect(first.json().map((label: { name: string }) => label.name)).toEqual([
      "help wanted",
      "bug",
    ]);
    expect(second.json()).toEqual(first.json());
    expect(github.calls.labels).toBe(1);
  });

  it("shows matched issues with their current state", async () => {
    const { app, signUpAndSubscribe } = await setup();
    const { cookie, subscription, channelId } = await signUpAndSubscribe();
    const { db } = database();
    const repo = await db.select().from(repositories).then(one);
    const event = await db
      .insert(events)
      .values({
        repoId: repo.id,
        issueNumber: 7,
        type: "issue.opened",
        occurredAt: new Date(),
        dedupeKey: "e1",
        issue: {
          number: 7,
          title: "Improve docs",
          htmlUrl: "https://github.com/acme/repo/issues/7",
          labels: [{ nodeId: "LA_2", name: "help wanted", color: "008672" }],
          assignees: [],
          authorLogin: "octocat",
        },
      })
      .returning()
      .then(one);
    await db.insert(deliveries).values({
      eventId: event.id,
      subscriptionId: subscription.id,
      channelId,
      frequency: "instant",
    });

    const feed = await app.inject({ method: "GET", url: "/v1/me/feed", headers: { cookie } });

    expect(feed.json()).toMatchObject({
      items: [
        {
          type: "issue.opened",
          repo: { fullName: "acme/repo" },
          issue: { number: 7, title: "Improve docs", state: "open", labels: ["help wanted"] },
        },
      ],
      nextBefore: null,
    });
  });
});
