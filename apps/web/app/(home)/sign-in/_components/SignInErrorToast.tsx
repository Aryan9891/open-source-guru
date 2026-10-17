"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

/** Shows the error GitHub sent back as a toast. The fixed id keeps it to one toast per page. */
export function SignInErrorToast({ message }: { message: string }) {
  useEffect(() => {
    // Some messages are long: leave time to read them.
    toast.error(message, { id: "sign-in-error", duration: 8000 });
  }, [message]);

  return null;
}
