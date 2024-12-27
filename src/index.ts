import "dotenv/config";
import express, { NextFunction, Request, Response, Router } from "express";
import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import MongoDB from "./config/db";
import { HolderController } from "./controllers/HolderController";
import { IssuerController } from "./controllers/IssuerController";
import { VerifierController } from "./controllers/VerifierController";
import { UnifiedAgent } from "./types/UnifiedAgent";

const baseUrl = process.env.BASE_URL || "http://localhost";
const port = parseInt(process.env.API_PORT || "3000", 10);

const verifierRouter = Router();
const issuerRouter = Router();
const app = express();
app.use(express.json());
app.use(cors());
app.use("/oid4vci", issuerRouter);
app.use("/siop", verifierRouter);

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API de Credenciales Verificables",
      version: "1.0.0",
      description:
        "API para la emisión y verificación de credenciales verificables utilizando OpenID4VC.",
    },
  },
  apis: [path.join(__dirname, "../swagger.yaml")],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

async function initializeAgents() {
  console.log("Inicializando el agente consolidado...");
  const today = new Date();
  const now = new Date(); // Obtenemos la fecha y hora actual
  const dateString = now.toISOString().slice(0, 10).replace(/-/g, ""); // yyyy-mm-dd -> yyyymmdd
  const timeString = now.toISOString().slice(11, 16).replace(/:/g, ""); // HH:MM -> HHMM
  const name = `tantan-wallet-${dateString}${timeString}`; // Concatenamos la fecha y hora
  const unifiedAgent = await UnifiedAgent.build(
    name,
    app,
    issuerRouter,
    verifierRouter
  );

  // Inicializamos la base de datos
  await MongoDB.init();

  console.log("Agente consolidado y base de datos inicializados.");

  // Inicializamos los controladores con la instancia del agente consolidado
  const issuerController = new IssuerController(unifiedAgent);
  const holderController = new HolderController(unifiedAgent);
  const verifierController = new VerifierController(unifiedAgent);

  // Rutas del Holder
  app.post(
    "/holder/resolveCredentialOffer",
    holderController.resolveCredentialOffer.bind(holderController)
  );
  app.post(
    "/holder/requestCredential",
    holderController.requestCredential.bind(holderController)
  );
  app.post(
    "/holder/resolveProofRequest",
    holderController.resolveProofRequest.bind(holderController)
  );
  app.post(
    "/holder/acceptPresentationRequest",
    holderController.acceptPresentationRequest.bind(holderController)
  );

  // Rutas del Issuer
  app.post(
    "/issuer/createCredentialOffer",
    issuerController.createProofRequest.bind(issuerController)
  );
  console.log("Ruta '/issuer/createCredentialOffer' registrada");

  // Rutas del Verifier
  app.post(
    "/verifier/createProofRequest",
    verifierController.createProofRequest.bind(verifierController)
  );

  // Nueva ruta /health/live
  app.get("/health/live", (req: Request, res: Response, next: NextFunction) => {
    res.status(200).send("OK");
  });

  app.use((req, res, next) => {
    if (!res.headersSent) {
      // Verifica que no se haya enviado ya una respuesta
      res
        .status(404)
        .send(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
    } else {
      next(); // Continúa con el flujo si ya se enviaron los headers
    }
  });

  return unifiedAgent;
}

// Inicializamos los agentes y el servidor
async function main() {
  const unifiedAgent = await initializeAgents(); // Inicializa el agente y devuelve la instancia

  app.listen(port, async () => {
    console.log(`API escuchando en ${baseUrl}:${port}`);

    // Ahora que el servidor está activo, registra los transportes del agente
    try {
      await unifiedAgent.registerTransports(app);
      console.log("Transportes del agente registrados correctamente.");
    } catch (error) {
      console.error("Error al registrar los transportes:", error);
      process.exit(1); // Detener el proceso si hay un error crítico
    }
  });
}

main();
function cors(): any {
  throw new Error("Function not implemented.");
}
