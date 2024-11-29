import { Router } from "express";
import {
  createProofRequest,
  decodeMDLQR,
} from "../controllers/VerifierController";

const verifierRouter = Router();

verifierRouter.post("/create-proof-request", createProofRequest);
verifierRouter.post("/process-mdl", decodeMDLQR);

export default verifierRouter;
