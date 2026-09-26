import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const SITE_URL = "https://amit9838.github.io/ascent/";

function setMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="canonical"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo({
  title,
  description,
}: {
  title: string;
  description: string;
}): void {
  const { pathname } = useLocation();
  useEffect(() => {
    const url = `${SITE_URL}#${pathname}`;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setCanonical(url);
  }, [title, description, pathname]);
}
