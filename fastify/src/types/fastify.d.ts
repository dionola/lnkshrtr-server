import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      username: string;
      email: string;
      createdAt: Date;
    };
  }
}
