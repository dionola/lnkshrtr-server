import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { cache } from "../lib/redis";

declare module "fastify" {
  interface FastifyInstance {
    cache: typeof cache;
  }
}

export default fp(async function redisPlugin(fastify: FastifyInstance) {
  fastify.decorate("cache", cache);
});
