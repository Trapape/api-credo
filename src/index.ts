import "dotenv/config";
import express from "express";
import MongoDB from "./config/db";
import {
  acceptPresentationRequest,
  getHolderInstance,
  requestCredential,
  resolveCredentialOffer,
  resolveProofRequest,
} from "./controllers/HolderController";
import {
  createCredentialOffer,
  getIssuerInstance,
} from "./controllers/IssuerController";
import {
  createProofRequest,
  getVerifierInstance,
} from "./controllers/VerifierController";
import verifierRouter from "./routes/verifierRoutes";

const app = express();
const port = process.env.API_PORT || 0;

app.use(express.json());

async function initializeAgents() {
  await getHolderInstance();
  await getIssuerInstance();
  await getVerifierInstance();
  await MongoDB.init();
}

initializeAgents()
  .then(async () => {
    console.log("Agentes inicializados");

    app.post("/holder/resolveCredentialOffer", resolveCredentialOffer);
    app.post("/holder/requestCredential", requestCredential);
    app.post("/holder/resolveProofRequest", resolveProofRequest);
    app.post("/holder/acceptPresentationRequest", acceptPresentationRequest);

    app.post("/issuer/createCredentialOffer", createCredentialOffer);

    app.post("/verifier/createProofRequest", createProofRequest);

    app.use("/verifier", verifierRouter);

    app.listen(port, () => {
      console.log(`API escuchando en http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Error al inicializar los agentes:", error);
  });
