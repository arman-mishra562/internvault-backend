import { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodSchema, ZodError } from "zod";

type SchemaKey = "body" | "query" | "params";

const validateRequest = (
  schemas: Partial<Record<SchemaKey, ZodSchema<any>>>
): RequestHandler => {
  return (req, res, next): void => {
    try {
      for (const key of Object.keys(schemas) as SchemaKey[]) {
        const schema = schemas[key];
        if (!schema) continue;

        const parseResult = schema.safeParse(req[key]);
        if (!parseResult.success) {
          const errors = parseResult.error.flatten().fieldErrors;
          // early exit with void return
          res.status(400).json({ errors });
          return;
        }

        // overwrite with parsed data
        req[key] = parseResult.data;
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.flatten().fieldErrors;
        res.status(400).json({ errors });
        return;
      }
      next(err);
    }
  };
};

export default validateRequest;