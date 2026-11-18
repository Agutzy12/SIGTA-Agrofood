/**
 * Aplicación Express: API REST en /api. Las pantallas están en el repositorio SIGTA-Agrofood-Front.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { ORIGENES_PERMITIDOS } from './config.js';
import { crearRouter } from './rutas.js';
import { HttpError, errorDeRegla } from './errores.js';
import { hayBaseConfigurada } from './db.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // CORS: las pantallas se publican en otro dominio y llaman a esta API.
  // La sesión viaja en la cabecera Authorization (no en cookies), así que alcanza con permitir el origen.
  app.use((req, res, next) => {
    const origen = req.headers.origin;
    if (origen && (ORIGENES_PERMITIDOS.includes('*') || ORIGENES_PERMITIDOS.includes(origen))) {
      res.setHeader('Access-Control-Allow-Origin', origen);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Si el servidor se publicó sin base de datos, se avisa con un mensaje claro en vez de un error genérico
  app.use('/api', (_req, res, next) => {
    if (hayBaseConfigurada()) return next();
    res.status(503).json({ error: 'Falta configurar la base de datos (variable DATABASE_URL). Ver el README del repositorio.' });
  });
  app.use('/api', crearRouter());
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Ruta inexistente' }); });

  // Manejo de errores: todo error termina en una respuesta JSON { error: "mensaje" }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    const regla = errorDeRegla(error); // triggers de la base (bloqueo lógico, protocolo inalterable)
    if (regla) return res.status(regla.status).json({ error: regla.message });
    if ((error as { type?: string })?.type === 'entity.parse.failed') return res.status(400).json({ error: 'El pedido no es un JSON válido' });
    console.error(error);
    return res.status(500).json({ error: 'Ocurrió un error interno en el servidor' });
  });
  return app;
}
