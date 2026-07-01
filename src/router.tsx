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
    // Honor Vite's base path so the router works when the site is served
    // under a sub-path (e.g. GitHub Pages project sites: `/<repo>/`).
    // BASE_URL is always `/<something>/` with trailing slash; strip it for
    // TanStack Router's basepath which expects no trailing slash (or "/").
    basepath: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
  });

  return router;
};
