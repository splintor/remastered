import { RouteTree } from "./createRouteTreeFromImportGlob";
import React from "react";
import { Outlet, RouteObject, useClosestRoute } from "react-router";

export function useRouteModule(): string {
  return (useClosestRoute()! as any).routeFile;
}

export function routeTreeIntoReactRouterRoute(
  routeTree: RouteTree
): RouteObjectWithFilename[] {
  const routes: RouteObjectWithFilename[] = [];

  for (const key in routeTree) {
    const branch = routeTree[key];
    const Element = branch.element ?? Outlet;
    const element = <Element />;
    routes.push({
      caseSensitive: true,
      path: key,
      element,
      children: routeTreeIntoReactRouterRoute(branch.children),
      routeFile: branch.filepath,
    });
  }

  return routes;
}

export type RouteObjectWithFilename = RouteObject & {
  routeFile?: string;
};