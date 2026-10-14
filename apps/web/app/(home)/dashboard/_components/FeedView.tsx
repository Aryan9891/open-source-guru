"use client";

import { useCallback, useState } from "react";
import { Feed } from "./Feed";
import { PendingSubscriptionNotice } from "./PendingSubscriptionNotice";

/** The feed, plus the landing page's pending subscription (reloads the feed once created). */
export function FeedView() {
  const [reloadKey, setReloadKey] = useState(0);
  const onCreated = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <>
      <PendingSubscriptionNotice onCreated={onCreated} />
      <Feed reloadKey={reloadKey} />
    </>
  );
}
