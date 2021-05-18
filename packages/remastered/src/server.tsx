import fastify from "fastify";
import { createServer as createViteServer, ViteDevServer } from "vite";
import fastifyExpress from "fastify-express";
import fs from "fs";
import path from "path";
import fastifyStatic from "fastify-static";
import { Request as NFRequest } from "node-fetch";
import type { RenderFn } from "./entry-server";
import { chain } from "lodash-es";
import { getViteConfigPath } from "./getViteConfig";

const isProd = process.env.NODE_ENV === "production";

function findDistRoot() {
  if (isProd) {
    const places = [path.join(__dirname, ".."), process.cwd()];

    const newPlace = places
      .map((place) => {
        return path.join(place, "dist");
      })
      .find((place) => {
        const filePath = path.join(place, "server/entry.server.js");
        return fs.existsSync(filePath);
      });

    if (!newPlace) {
      throw new Error("Can't find place!");
    }

    return newPlace;
  }
}

export async function createServer(root: string) {
  process.env.REMASTER_PROJECT_DIR = root;
  const app = fastify({ logger: isProd });
  await app.register(fastifyExpress);
  app.addContentTypeParser("*", (_request, _payload, done) => done(null));

  const vite = isProd
    ? undefined
    : await createViteServer({
        root,
        configFile: getViteConfigPath({ ssr: false }),
        server: { middlewareMode: true },
      });

  const distRoot = findDistRoot();

  if (vite) {
    app.use(vite.middlewares);
  } else {
    await app.register(fastifyStatic, {
      root: path.join(distRoot!, "client/assets"),
      prefix: "/assets/",
    });
  }

  app.all("*", async (req, reply) => {
    const method = req.method.toUpperCase();
    const request = new NFRequest(req.url, {
      method,
      body: method !== "GET" && method !== "HEAD" ? req.raw : undefined,
      headers: chain(req.headers)
        .entries()
        .map(([key, value]) => value !== undefined && [key, String(value)])
        .compact()
        .value(),
    });
    const response = await renderRequest(
      await getViteHandlers(vite),
      request as unknown as Request,
      vite
    );
    const headers = chain([...response.headers.entries()])
      .fromPairs()
      .value();
    reply.status(response.status).headers(headers).send(response.body);
  });

  return app;
}

export async function renderRequest(
  handlers: ViteHandlers,
  request: Request,
  vite?: ViteDevServer
): Promise<Response> {
  try {
    const render: RenderFn = handlers.serverEntry.render;
    return await render({
      request,
      manifest: handlers.manifest,
      viteDevServer: vite,
      clientManifest: handlers.clientManifest,
    });
  } catch (e) {
    // If an error is caught, let vite fix the stracktrace so it maps back to
    // your actual source code.
    vite?.ssrFixStacktrace(e);
    console.error(e);
    const message = request.headers.has("x-debug") ? String(e) : e.message;
    return new Response(message, {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}

export async function main(root: string) {
  const port = process.env.PORT || 3000;
  console.log(`Bootstrapping...`);
  const app = await createServer(root);
  console.log(`Server bootstrapped. Listening at ${port}`);

  app.listen(port, "0.0.0.0");
}

if (require.main === module) {
  main(path.dirname(__dirname));
}

type ViteHandlers = {
  serverEntry: any;
  manifest?: Record<string, string[]>;
  clientManifest?: import("vite").Manifest;
};

async function getViteHandlers(
  vite: ViteDevServer | undefined
): Promise<ViteHandlers> {
  if (!vite) {
    const distRoot = findDistRoot();
    return {
      serverEntry: require(`${distRoot}/server/entry.server.js`),
      manifest: require(`${distRoot}/client/ssr-manifest.json`),
      clientManifest: require(`${distRoot}/client/manifest.json`),
    };
  } else {
    const entry = require.resolve("./entry-server.js");
    return {
      serverEntry: await vite.ssrLoadModule(entry),
    };
  }
}
