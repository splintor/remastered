import React from "react";
import { HeadersFn, LoaderFn, MetaFn, useRouteData } from "remastered";
import { Doc, readDocFile } from "../../readDocFile";
import { ogMeta } from "../../ogMeta";

type Data = Doc & { pathname: string };

export const loader: LoaderFn<Data> = async ({ params }) => {
  const doc = await readDocFile(params.path);

  if (!doc) {
    return null;
  }

  return {
    ...doc,
    pathname: `/docs/${params.path}`,
  };
};

export const headers: HeadersFn = async () => {
  return {
    ...(!__DEV__ && {
      "Cache-Control":
        "public, s-max-age=3600, must-revalidate, stale-while-revalidate=31536000",
    }),
  };
};

export default function DocPath() {
  const routeData = useRouteData<Data>();
  return (
    <>
      <h1 className="px-2 py-4 text-xl font-bold text-black text-opacity-90">
        {routeData.title}
      </h1>
      <div
        className="w-screen px-2 md:w-full prose"
        dangerouslySetInnerHTML={{ __html: routeData.content }}
      />
    </>
  );
}

export const meta: MetaFn<Data> = ({ data }) => {
  return {
    /* "og:url": `https://remastered.hagever.com${data.pathname}`, */
    ...ogMeta({
      title: `Remastered: ${data.title}`,
      description:
        data.description &&
        `${data.description
          .trim()
          .replace(/\.$/, "")}. Learn more about Remastered!`,
    }),
  };
};
