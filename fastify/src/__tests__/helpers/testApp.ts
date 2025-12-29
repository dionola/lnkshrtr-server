import { createApp } from "../../app";
import type { FastifyInstance } from "fastify";
import type { Server } from "http";

let _fastify: FastifyInstance | null = null;

export async function getServer(): Promise<Server> {
  if (!_fastify) {
    _fastify = await createApp();
    await _fastify.ready();
  }
  return _fastify.server;
}

afterAll(async () => {
  if (_fastify) {
    await _fastify.close();
    _fastify = null;
  }
});
