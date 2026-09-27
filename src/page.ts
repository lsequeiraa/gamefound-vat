// Pages whose prices already include tax, or that take payment: never touched.
const EXCLUDED_SEGMENTS = new Set(["yourpledge", "pledge", "orders", "checkout", "payment", "payments"]);

export function isExcludedPage(pathname: string): boolean {
  const segments = pathname.toLowerCase().split("/").filter(Boolean);
  // Skip "/projects/<creator>/<project>" so a project's own name never matches.
  const projects = segments.indexOf("projects");
  const rest = projects >= 0 ? segments.slice(projects + 3) : segments;
  return rest.some((segment) => EXCLUDED_SEGMENTS.has(segment));
}

/** The project ID from the page's server-rendered `window.__INITIAL_STATE__`. */
export function findProjectId(doc: Document): number | null {
  for (const script of doc.querySelectorAll("script:not([src])")) {
    const text = script.textContent ?? "";
    if (!text.includes("__INITIAL_STATE__")) continue;
    try {
      const state = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      const id = state?.projectContext?.projectID;
      return typeof id === "number" && id > 0 ? id : null;
    } catch {
      return null;
    }
  }
  return null;
}
