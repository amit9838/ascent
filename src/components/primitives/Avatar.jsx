import { useState } from "react";
import { cx } from "../../lib/cx.js";

// Profile image with a reliable fallback: the first character of `name`
// (uppercased) is shown when there is no photo OR the image fails to
// load (deleted Google photo, stale URL, offline, …).
export function Avatar({ src, name, alt = "", className, ...rest }) {
  const [failed, setFailed] = useState(false);
  const initial =
    (name ?? "").trim().slice(0, 1).toUpperCase() || "?";

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className={cx("shrink-0 rounded-full object-cover", className)}
        {...rest}
      />
    );
  }

  return (
    <span
      aria-hidden={alt ? undefined : "true"}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white",
        className
      )}
      {...rest}
    >
      {initial}
    </span>
  );
}
