import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // During SSR / prerendering, Nitro requests routes at their canonical path
    // (e.g. "/"), so the router must NOT strip a sub-path base there — otherwise
    // every route 404s during prerender and the homepage is never written. On the
    // client we honour BASE_URL so navigation works under a sub-path (e.g. GitHub
    // Pages project sites: `/<repo>/`). BASE_URL always ends with a trailing
    // slash; strip it for TanStack Router's basepath (which expects no trailing
    // slash, or "/").
    basepath: import.meta.env.SSR
      ? "/"
      : import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
  });

  return router;
};