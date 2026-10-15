"use client";

import Link from "next/link";
import { useId } from "react";
import { Switch } from "@/components/ui/Switch";
import { ROUTES } from "@/lib/constants";

/** The public profile switch, with what it shows and doesn't. */
export function ProfileVisibility({
  login,
  value,
  onChange,
  disabled = false,
}: {
  login: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const path = ROUTES.profile(login);

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-semibold">
          Public profile
        </label>
        <p id={`${id}-description`} className="text-sm text-muted">
          {value ? (
            <>
              Anyone can see it at{" "}
              <Link
                href={path}
                className="font-mono text-subtle underline underline-offset-4 hover:text-foreground"
              >
                {path}
              </Link>
              .
            </>
          ) : (
            "Off: nobody else can see your contributions."
          )}{" "}
          It shows your Open Source Contributions, streak and the goals you make public, never your
          email addresses or subscriptions.
        </p>
      </div>
      <Switch
        id={id}
        checked={value}
        onChange={onChange}
        disabled={disabled}
        describedBy={`${id}-description`}
      />
    </div>
  );
}
